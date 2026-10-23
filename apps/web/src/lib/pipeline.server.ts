import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import logger from '@/lib/logger.server';

/**
 * PocketBase's `ClientResponseError.message` is always the generic top-level
 * text ("Failed to create record.") — the actually useful part, which field
 * failed validation and why, lives in `.response.data` and was previously
 * being silently discarded everywhere an error's `.message` was logged or
 * shown to the user. This is what made "Failed to create record." on its own
 * undiagnosable; every PocketBase-originated error in this file should be
 * described with this instead of read via `error.message` directly.
 */
function describeError(error: unknown): string {
	if (error instanceof ClientResponseError) {
		const fieldErrors = error.response?.data;
		const detail = fieldErrors && Object.keys(fieldErrors).length > 0 ? ` — ${JSON.stringify(fieldErrors)}` : '';
		return `${error.message} (${error.status})${detail}`;
	}
	return error instanceof Error ? error.message : String(error);
}

const TRANSCRIPT_LIMIT = 60_000;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface LectureRecord {
	id: string;
	user: string;
	file: string;
	status: string;
}

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

export interface PrecomputedTranscript {
	text: string;
	segments: TranscriptSegment[];
	duration?: number | null;
}

const SYSTEM_JSON =
	'Respond with ONLY valid JSON matching this schema, no markdown fences, no extra text.';

// ---------- Schemas ----------

const notesSchema = z.object({
	title: z.string(),
	summary: z.string(),
	sections: z.array(
		z.object({
			heading: z.string(),
			bullets: z.array(z.string()),
			key_terms: z.array(z.string()).default([]),
		}),
	),
});

const flashcardsSchema = z.object({
	flashcards: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
});

const quizSchema = z.object({
	questions: z
		.array(
			z.object({
				question: z.string(),
				options: z.array(z.string()).length(4),
				correct_index: z.number().int().min(0).max(3),
				explanation: z.string(),
			}),
		)
		.min(1),
});

interface MindMapNode {
	topic: string;
	children?: MindMapNode[];
}

const mindMapSchema: z.ZodType<MindMapNode> = z.lazy(() =>
	z.object({ topic: z.string(), children: z.array(mindMapSchema).optional() }),
);

// ---------- PocketBase helpers ----------

const setStatus = (lectureId: string, status: string, errorMessage = '') =>
	pocketbaseAdmin.updateRecord('lectures', lectureId, {
		status,
		error_message: errorMessage,
	});

async function deleteExisting(collection: string, lectureId: string) {
	const records = await pocketbaseAdmin.listRecords<{ id: string }>(collection, {
		filter: `lecture = "${lectureId}"`,
		fields: 'id',
		perPage: 500,
	});
	for (const record of records.items) {
		await pocketbaseAdmin.deleteRecord(collection, record.id);
	}
}

/**
 * `transcripts.content` (a `text` field) was created with no explicit `max`,
 * so PocketBase applies its built-in default of 5000 characters — far too
 * small for a real transcript. Two other fixes were tried and ruled out
 * before this one:
 *
 *   - A schema migration: the pb_migrations directory isn't editable/
 *     deployable in every environment this runs in.
 *   - Raising the limit at runtime via the collections REST API
 *     (`PATCH /api/collections/transcripts`) using the superuser-
 *     authenticated `pocketbaseAdmin.send()` escape hatch: this works
 *     against a stock local PocketBase instance (verified end-to-end
 *     against a disposable one built from this repo's own migrations —
 *     GET+PATCH raised the limit and 6,000- and ~80,000-character
 *     transcripts both then saved successfully), but the actual hosting
 *     platform this runs on rejects it outright ("Not allowed to view
 *     collection."), evidently blocking schema-mutation endpoints from the
 *     app tier even for a superuser token.
 *
 * So instead: keep `content` populated with just a preview (capped to what
 * the fixed schema already allows) and store the full, untruncated
 * transcript in `segments` instead — that field is `json`-typed, which
 * PocketBase defaults to a much more generous 1MB limit, and needs no schema
 * change to hold `{ segments, fullText }` instead of a bare array.
 * `TranscriptTab` (transcript-tab.tsx) reads it back in this shape.
 */
const TRANSCRIPT_CONTENT_PREVIEW_MAX = 5000;

/**
 * Creates several records with individual `createRecord` calls instead of
 * `pocketbaseAdmin.createRecords` (PocketBase's Batch API), which requires
 * `settings.batch.enabled` on the target instance — a deploy-time setting
 * that can silently be off, in which case the whole batch call fails outright
 * with an opaque "Batch transaction failed.", taking every record in it down
 * together. Individual creates have no such dependency, at the cost of the
 * all-or-nothing atomicity batch gave: a failure partway through can leave
 * some records written. Every caller here already deletes-then-recreates via
 * `deleteExisting` before calling this, so a partial set is self-healing on
 * the next retry rather than a lasting inconsistency.
 */
async function createRecordsIndividually(
	collection: string,
	records: Record<string, unknown>[],
): Promise<void> {
	await Promise.all(records.map((record) => pocketbaseAdmin.createRecord(collection, record)));
}

// ---------- Step 1: transcription (swappable, multi-provider) ----------

/**
 * Aborts a hung request instead of letting `processLecture` hang indefinitely.
 * Generous on purpose: a self-hosted Whisper API (the fallback provider) can
 * legitimately take a long time on a long recording — a 5-minute cap here was
 * measured aborting the fallback on a 40-minute file well before it had a
 * chance to finish, turning "slow" into "fails outright".
 */
const TRANSCRIBE_TIMEOUT_MS = 20 * 60 * 1000;

interface WhisperProvider {
	label: string;
	baseUrl: string;
	apiKey: string;
	model: string;
}

/**
 * Providers to try, in order. Both speak the same OpenAI-compatible
 * `/v1/audio/transcriptions` multipart schema, so adding one is just config:
 *
 *   1. Groq (`GROQ_API_KEY` / `GROQ_MODEL`) — primary when configured. Groq's
 *      Whisper inference is much faster than most hosted Whisper APIs, which
 *      is most of what made transcription the slow/unreliable leg of the
 *      pipeline.
 *   2. `WHISPER_BASE_URL` / `WHISPER_API_KEY` / `WHISPER_MODEL` — the
 *      previously-primary provider, now the fallback if Groq is unset or a
 *      lecture fails on it (e.g. a file over Groq's plan size limit).
 */
function transcriptionProviders(): WhisperProvider[] {
	// Local development mode: send recordings only to the user's local Whisper
	// bridge. This deliberately bypasses Groq and any remote transcription API,
	// so a local test cannot unexpectedly consume hosted transcription credits.
	if (process.env.WHISPER_LOCAL_ONLY?.toLowerCase() === 'true') {
		const baseUrl = process.env.WHISPER_BASE_URL;
		const apiKey = process.env.WHISPER_API_KEY;
		const model = process.env.WHISPER_MODEL;
		if (!baseUrl || !apiKey || !model) {
			throw new Error(
				'Local Whisper mode is enabled, but WHISPER_BASE_URL, WHISPER_API_KEY, or WHISPER_MODEL is missing.',
			);
		}
		return [{
			label: 'Local Whisper',
			baseUrl: baseUrl.replace(/\/+$/, ''),
			apiKey,
			model,
		}];
	}

	const providers: WhisperProvider[] = [];

	if (process.env.GROQ_API_KEY) {
		providers.push({
			label: 'Groq',
			baseUrl: 'https://api.groq.com/openai',
			apiKey: process.env.GROQ_API_KEY,
			model: process.env.GROQ_MODEL || 'whisper-large-v3-turbo',
		});
	}

	if (process.env.WHISPER_BASE_URL && process.env.WHISPER_API_KEY && process.env.WHISPER_MODEL) {
		providers.push({
			label: 'Whisper',
			baseUrl: process.env.WHISPER_BASE_URL,
			apiKey: process.env.WHISPER_API_KEY,
			model: process.env.WHISPER_MODEL,
		});
	}

	return providers;
}

async function transcribeWithProvider(
	provider: WhisperProvider,
	fileBytes: ArrayBuffer,
	fileName: string,
): Promise<{ text: string; segments: TranscriptSegment[]; duration: number | null }> {
	const form = new FormData();
	form.append('file', new Blob([fileBytes]), fileName);
	form.append('model', provider.model);
	form.append('response_format', 'verbose_json');

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`${provider.baseUrl}/v1/audio/transcriptions`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${provider.apiKey}` },
			body: form,
			signal: controller.signal,
		});
	} catch (error) {
		const timedOut = error instanceof Error && error.name === 'AbortError';
		throw new Error(
			timedOut
				? `${provider.label} transcription timed out after ${TRANSCRIBE_TIMEOUT_MS / 1000}s.`
				: `${provider.label} transcription request failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		// 413, or a 400 whose body mentions file size, means the provider rejected
		// the file outright over its own size cap (e.g. Groq's free-tier 25MB
		// limit) — worth its own clear message, since the raw provider response is
		// usually terse JSON that doesn't say so explicitly.
		const tooLarge = response.status === 413 || /file.{0,20}(size|large)|too large/i.test(body);
		const error = new Error(
			tooLarge
				? `${provider.label} rejected the file as too large for its plan (${response.status}).`
				: `${provider.label} transcription failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`,
		);
		(error as Error & { status?: number }).status = response.status;
		throw error;
	}

	const data = (await response.json()) as {
		text?: string;
		duration?: number;
		segments?: { start: number; end: number; text: string }[];
	};
	if (!data.text) throw new Error(`${provider.label} returned no text.`);

	return {
		text: data.text,
		segments: (data.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
		duration: typeof data.duration === 'number' ? Math.round(data.duration) : null,
	};
}

async function transcribeAudio(lecture: LectureRecord): Promise<{
	text: string;
	segments: TranscriptSegment[];
	duration: number | null;
}> {
	const providers = transcriptionProviders();
	if (providers.length === 0) {
		throw new Error('Transcription provider is not configured.');
	}

	const fileToken = await pocketbaseAdmin.getFileToken();
	const pbUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';
	const fileUrl = `${pbUrl}/api/files/lectures/${lecture.id}/${lecture.file}?token=${fileToken}`;
	const fileResponse = await fetch(fileUrl);
	if (!fileResponse.ok) {
		throw new Error(`Could not download lecture file: ${fileResponse.status} ${fileResponse.statusText}`);
	}
	const buffer = await fileResponse.arrayBuffer();

	let lastError: unknown = null;
	for (let i = 0; i < providers.length; i += 1) {
		const provider = providers[i];
		try {
			return await transcribeWithProvider(provider, buffer, lecture.file);
		} catch (error) {
			lastError = error;
			const status = (error as Error & { status?: number }).status;
			const hasNext = i < providers.length - 1;
			logger.warn(
				`${provider.label} transcription failed (${status ?? 'no status'}): ${String(error)}${hasNext ? ' — trying next provider.' : '.'}`,
			);
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Transcription failed.');
}

// ---------- Step 2: AI generation ----------

/**
 * Generation runs through two providers, in order:
 *
 *   1. The platform-managed Integrated AI gateway (credentials provisioned by
 *      the platform in the environment — never the visitor's). This is the
 *      primary path so the pipeline does not depend on a user-supplied key.
 *   2. A direct Anthropic Messages API call using ANTHROPIC_API_KEY /
 *      ANTHROPIC_MODEL from apps/web/.env, as a fallback.
 *
 * Both paths return raw model text; the caller extracts + validates JSON.
 */

const requireEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set — is Integrated AI enabled for this site?`);
	return value;
};

/** Collect the streamed text frames from the platform gateway's SSE response. */
async function collectPlatformStream(response: Response): Promise<string> {
	if (!response.body) throw new Error('Platform AI returned no response body.');
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let text = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;
				const payload = line.slice('data: '.length).trim();
				if (!payload || payload === '[DONE]') continue;
				let event: { type?: string; data?: { content?: unknown } };
				try {
					event = JSON.parse(payload);
				} catch {
					continue;
				}
				if (event.type === 'error') {
					throw new Error(String(event.data?.content ?? 'Platform AI stream error.'));
				}
				if (event.type === 'content' && typeof event.data?.content === 'string') {
					text += event.data.content;
				}
			}
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	return text;
}

/**
 * One turn of the user prompt, in the order it is sent. `cache` marks a block
 * that is byte-identical across many calls (here: the lecture transcript,
 * reused by all four generation tasks) so it can be put first and cached —
 * caching only matches an identical *prefix*, so the shared block must lead
 * and whatever varies per call (the task instructions) must come after it.
 */
interface PromptBlock {
	text: string;
	cache?: boolean;
}

const joinBlocks = (blocks: PromptBlock[]): string => blocks.map((block) => block.text).join('\n\n');

/** Primary path: platform-managed Integrated AI gateway. */
async function callPlatformAi(system: string, blocks: PromptBlock[]): Promise<string> {
	const apiUrl = requireEnv('INTEGRATED_AI_API_URL');
	const apiKey = requireEnv('INTEGRATED_AI_API_KEY');
	const websiteId = process.env.WEBSITE_ID;
	if (!websiteId) throw new Error('WEBSITE_ID is not set.');

	const response = await fetch(`${apiUrl}/generate`, {
		method: 'POST',
		headers: {
			Accept: 'text/event-stream',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
			...(process.env.PROXY_ENTRANCE_ID ? { 'X-Proxy-Entrance-Id': process.env.PROXY_ENTRANCE_ID } : {}),
		},
		body: JSON.stringify({
			website_id: websiteId,
			// The gateway's history entries take a plain string — it has no
			// cache_control concept in this API, so blocks are just concatenated.
			history: [{ role: 'user', content: joinBlocks(blocks) }],
			system_prompt: system,
			stream: true,
			environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
		}),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		let message = detail;
		try {
			const parsed = JSON.parse(detail);
			message = parsed?.detail || parsed?.error?.message || parsed?.message || detail;
		} catch {
			// keep raw
		}
		const error = new Error(`Platform AI request failed: ${response.status} ${response.statusText} — ${String(message).slice(0, 300)}`);
		(error as Error & { status?: number }).status = response.status;
		throw error;
	}

	const text = await collectPlatformStream(response);
	if (!text.trim()) throw new Error('Platform AI returned an empty response.');
	return text;
}

/**
 * Fallback path: direct Anthropic Messages API using the user's .env credentials.
 *
 * Sends `blocks` as separate content blocks (instead of one flattened string)
 * so the transcript block can carry `cache_control`. All four generation calls
 * for a lecture (notes/flashcards/quiz/mind map) share the same transcript
 * text as their first block — the first call that reaches Anthropic writes it
 * to the 5-minute ephemeral cache, and every call after that (retries of this
 * call, and the other three tasks, as long as they land within the window)
 * reads it back at a fraction of the cost and latency instead of reprocessing
 * ~15-16k transcript tokens from scratch each time.
 */
async function callAnthropic(system: string, blocks: PromptBlock[], maxTokens: number): Promise<string> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	const model = process.env.ANTHROPIC_MODEL;
	if (!apiKey || !model) throw new Error('AI provider is not configured.');

	const content = blocks.map((block) => ({
		type: 'text' as const,
		text: block.text,
		...(block.cache && { cache_control: { type: 'ephemeral' as const } }),
	}));

	const response = await fetch(ANTHROPIC_URL, {
		method: 'POST',
		headers: {
     'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
  ...(process.env.ANTHROPIC_WORKSPACE_ID
    ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID }
    : {}),
},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			system,
			messages: [{ role: 'user', content }],
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		let detail = body;
		try {
			const parsed = JSON.parse(body);
			detail = parsed?.error?.message || parsed?.message || body;
		} catch {
			// keep raw body
		}
		const error = new Error(
			`Claude request failed: ${response.status} ${response.statusText} — ${detail.slice(0, 300)}`,
		);
		(error as Error & { status?: number }).status = response.status;
		throw error;
	}

	const data = (await response.json()) as { content?: { type: string; text?: string }[] };
	const text = data.content?.find((block) => block.type === 'text')?.text ?? '';
	if (!text.trim()) throw new Error('Claude returned an empty response.');
	return text;
}

/**
 * Calls the model via the platform gateway, falling back to the direct
 * Anthropic API when the gateway is unavailable (misconfigured, down, or out
 * of credits). Returns raw model text for the caller to parse as JSON.
 */
async function callModel(system: string, blocks: PromptBlock[], maxTokens: number): Promise<string> {
	try {
		return await callPlatformAi(system, blocks);
	} catch (platformError) {
		const status = (platformError as Error & { status?: number }).status;
		// 402 (out of credits) and 401/403 (auth) on the gateway are not fixed
		// by retrying on Anthropic with a different (also invalid) key, but the
		// fallback is cheap and gives the user a second, clearer error if the
		// gateway is simply down. Log and attempt the fallback.
		logger.warn(`Platform AI failed (${status ?? 'no status'}): ${String(platformError)}. Trying Anthropic fallback.`);
		return callAnthropic(system, blocks, maxTokens);
	}
}

/** Strip markdown fences and surrounding prose so JSON.parse succeeds on real model output. */
function extractJson(text: string): string {
	const trimmed = text.trim();
	const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (fenceMatch) return fenceMatch[1].trim();
	// Fall back to the outermost JSON object/array if the model added prose.
	const firstBrace = trimmed.indexOf('{');
	const firstBracket = trimmed.indexOf('[');
	let start = -1;
	if (firstBrace === -1) start = firstBracket;
	else if (firstBracket === -1) start = firstBrace;
	else start = Math.min(firstBrace, firstBracket);
	if (start === -1) return trimmed;
	const lastBrace = trimmed.lastIndexOf('}');
	const lastBracket = trimmed.lastIndexOf(']');
	let end = -1;
	if (lastBrace === -1) end = lastBracket;
	else if (lastBracket === -1) end = lastBrace;
	else end = Math.max(lastBrace, lastBracket);
	if (end === -1 || end <= start) return trimmed;
	return trimmed.slice(start, end + 1).trim();
}

/** Map a raw provider error into a message the student sees on the lecture page. */
function userFacingError(message: string): string {
	// Appended to every friendly message below so the raw cause is visible right
	// on the lecture page — the alternative is digging through server logs
	// (`logger.warn`/`.error`, which only ever go to the server process's
	// stdout/stderr, never the browser console), which isn't always accessible
	// or easy to find depending on how this is hosted.
	const detail = ` (details: ${message.slice(0, 200)})`;

	// PocketBase's own generic wrapper text for a record create/update that
	// failed validation. Checked first, unconditionally: this is a storage-layer
	// problem, not anything to do with the AI provider, so it must never fall
	// through to the AI-specific patterns below — it did once, by coincidence
	// (a "must be no more than 5000 characters" validation message contains the
	// digits "500", which matched the 5xx-provider-error pattern) and produced
	// an actively misleading "AI provider is temporarily unavailable".
	if (/Failed to (create|update) record/i.test(message)) {
		return `There was a problem saving this. This is usually a data or configuration issue rather than something that resolves itself, so retrying may not help.${detail}`;
	}

	if (/too large for its plan/i.test(message)) {
		return `This recording is too large for the transcription service to accept. Try a shorter recording, compress the audio to a lower bitrate, or upgrade the transcription provider's plan for larger files.${detail}`;
	}
	if (/transcription timed out/i.test(message)) {
		return `Transcription is taking longer than expected for a recording this long. Please retry — shorter recordings transcribe reliably.${detail}`;
	}
	// Word-boundaried so these HTTP-status patterns can't match digits that
	// happen to appear inside an unrelated larger number (as above).
	if (/\b402\b|insufficient credits|purchase more credits/i.test(message)) {
		return `The AI service is out of credits. Please add Integrated AI credits (or set a valid ANTHROPIC_API_KEY) and retry.${detail}`;
	}
	if (/\b401\b|authentication_error|API key is invalid/i.test(message)) {
		return `The AI provider rejected the API key. Please check that ANTHROPIC_API_KEY is valid and try again.${detail}`;
	}
	if (/\b429\b|rate_limit/i.test(message)) {
		return `The AI provider is rate-limiting requests. Please wait a minute and retry.${detail}`;
	}
	if (/\b5\d\d\b|overloaded|server error/i.test(message)) {
		return `The AI provider is temporarily unavailable. Please retry in a moment.${detail}`;
	}
	if (/Could not parse|JSON/i.test(message)) {
		return `The AI returned a malformed response. Retrying usually fixes this — please try again.${detail}`;
	}
	return message;
}

/** Ask the model for JSON, extract the JSON payload, parse, and validate against the schema. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateValidated<T>(
	schema: z.ZodType<T>,
	blocks: PromptBlock[],
	maxTokens: number,
): Promise<T> {
	let lastError: unknown = null;
	const MAX_ATTEMPTS = 3;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		try {
			const text = await callModel(SYSTEM_JSON, blocks, maxTokens);
			const jsonStr = extractJson(text);
			let raw: unknown;
			try {
				raw = JSON.parse(jsonStr);
			} catch {
				logger.error(`JSON parse failed for AI response (first 500 chars): ${text.slice(0, 500)}`);
				throw new Error('Could not parse AI response as JSON.');
			}
			return schema.parse(raw);
		} catch (error) {
			lastError = error;
			const status = (error as Error & { status?: number }).status;
			// Auth, permission, and out-of-credits errors will never succeed by retrying — bail immediately.
			if (status === 401 || status === 403 || status === 402) throw error;
			if (attempt < MAX_ATTEMPTS - 1) {
				// A transient overload (the common real-world case here) needs time to
				// clear, not an immediate retry — and all four generation tasks for a
				// lecture hit this at once, so retrying with zero delay just hammers
				// the same overloaded provider four times in near-lockstep instead of
				// giving it a chance to recover. Exponential backoff with jitter
				// staggers the four tasks' retries apart from each other too.
				const backoffMs = 1000 * 2 ** attempt + Math.random() * 500;
				logger.warn(`Generation attempt ${attempt + 1} failed: ${String(error)}. Retrying in ${Math.round(backoffMs)}ms.`);
				await sleep(backoffMs);
			}
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Generation failed.');
}

/**
 * The transcript block shared by all four generation tasks below. It always
 * leads its call's blocks array and is marked `cache: true` so — on the
 * Anthropic path — it becomes a single cached prefix instead of being
 * reprocessed four times (see `callAnthropic`).
 */
const transcriptBlock = (transcript: string): PromptBlock => ({
	text: `Transcript:\n${transcript}`,
	cache: true,
});

const generateNotes = (transcript: string) =>
	generateValidated(
		notesSchema,
		[
			transcriptBlock(transcript),
			{
				text: 'Create structured revision notes from the lecture transcript above. Schema: { "title": string, "summary": string, "sections": [{ "heading": string, "bullets": string[], "key_terms": string[] }] }. Use 4-8 sections.',
			},
		],
		4096,
	);

const generateFlashcards = (transcript: string) =>
	generateValidated(
		flashcardsSchema,
		[
			transcriptBlock(transcript),
			{
				text: 'Create 15 to 25 study flashcards from the lecture transcript above. Schema: { "flashcards": [{ "question": string, "answer": string }] }. Answers should be concise.',
			},
		],
		4096,
	);

const generateQuiz = (transcript: string) =>
	generateValidated(
		quizSchema,
		[
			transcriptBlock(transcript),
			{
				text: 'Create a 10-question multiple-choice quiz from the lecture transcript above. Schema: { "questions": [{ "question": string, "options": string[4], "correct_index": number (0-3), "explanation": string }] }.',
			},
		],
		4096,
	);

const generateMindMap = (transcript: string) =>
	generateValidated(
		mindMapSchema,
		[
			transcriptBlock(transcript),
			{
				text: 'Create a hierarchical mind map of the lecture transcript above, max depth 4. Schema: { "topic": string, "children": [{ "topic": string, "children": [...] }] }. Keep node labels short (2-6 words).',
			},
		],
		4096,
	);

// ---------- Orchestration ----------

export async function processLecture(
	lectureId: string,
	precomputed?: PrecomputedTranscript,
): Promise<void> {
	try {
		// Fetching the lecture record belongs inside the try: it is a PocketBase
		// call like any other here, and if it throws (auth hiccup, PocketBase
		// mid-restart) while sitting outside the try/catch, the lecture is left at
		// whatever status it already had — usually "pending" — with no error
		// message and no way for the user to retry.
		const lecture = await pocketbaseAdmin.getRecord<LectureRecord>('lectures', lectureId);

		let transcript: { text: string; segments: TranscriptSegment[]; duration: number | null };

		if (precomputed && precomputed.text) {
			// Client already transcribed locally with Transformers.js — skip the API.
			await setStatus(lectureId, 'generating');
			transcript = {
				text: precomputed.text,
				segments: precomputed.segments ?? [],
				duration: precomputed.duration ?? null,
			};
		} else {
			await setStatus(lectureId, 'transcribing');
			transcript = await transcribeAudio(lecture);
		}

		await deleteExisting('transcripts', lectureId);
		await pocketbaseAdmin.createRecord('transcripts', {
			lecture: lectureId,
			user: lecture.user,
			// Preview only — `content`'s 5000-char cap can't be raised on this
			// platform (see TRANSCRIPT_CONTENT_PREVIEW_MAX above). The full text
			// lives in `segments.fullText` instead.
			content: transcript.text.slice(0, TRANSCRIPT_CONTENT_PREVIEW_MAX),
			segments: { segments: transcript.segments, fullText: transcript.text },
		});
		if (transcript.duration) {
			await pocketbaseAdmin.updateRecord('lectures', lectureId, { duration_seconds: transcript.duration });
		}

		await setStatus(lectureId, 'generating');
		const excerpt = transcript.text.slice(0, TRANSCRIPT_LIMIT);

		const [notes, flashcards, quiz, mindMap] = await Promise.allSettled([
			generateNotes(excerpt),
			generateFlashcards(excerpt),
			generateQuiz(excerpt),
			generateMindMap(excerpt),
		]);

		const failedParts: string[] = [];
		const failureReasons: string[] = [];

		/**
		 * `stage` is 'generation' when the model call itself failed (already
		 * isolated per task by `Promise.allSettled` above) or 'save' when
		 * generation succeeded but writing the result to PocketBase failed —
		 * e.g. a Batch API / rule / validation error on one collection. Either
		 * way this only marks that one part as failed; it must never throw, or
		 * a single part's DB write failure would escape to the outer catch and
		 * fail the whole lecture, discarding the other three parts along with
		 * it (this is what "Batch transaction failed" used to do before these
		 * writes were wrapped in their own try/catch below).
		 */
		const captureFailure = (part: string, reason: unknown, stage: 'generation' | 'save' = 'generation') => {
			failedParts.push(part);
			const msg = describeError(reason);
			if (!failureReasons.some((r) => r === msg)) failureReasons.push(msg);
			logger.warn(`${part} ${stage} failed: ${msg}`);
		};

		if (notes.status === 'fulfilled') {
			try {
				await deleteExisting('notes', lectureId);
				await pocketbaseAdmin.createRecord('notes', {
					lecture: lectureId,
					user: lecture.user,
					content: notes.value,
				});
			} catch (error) {
				captureFailure('notes', error, 'save');
			}
		} else {
			captureFailure('notes', notes.reason);
		}

		if (flashcards.status === 'fulfilled') {
			try {
				await deleteExisting('flashcards', lectureId);
				await createRecordsIndividually(
					'flashcards',
					flashcards.value.flashcards.map((card) => ({
						lecture: lectureId,
						user: lecture.user,
						question: card.question,
						answer: card.answer,
						review_state: 'new',
					})),
				);
			} catch (error) {
				captureFailure('flashcards', error, 'save');
			}
		} else {
			captureFailure('flashcards', flashcards.reason);
		}

		if (quiz.status === 'fulfilled') {
			try {
				await deleteExisting('quiz_questions', lectureId);
				await createRecordsIndividually(
					'quiz_questions',
					quiz.value.questions.map((q) => ({
						lecture: lectureId,
						user: lecture.user,
						question: q.question,
						// The real options + answer live together in this JSON field —
						// see QuizOptions in types.ts for why `correct_index` (the
						// dedicated number field below) can't hold the answer itself.
						options: { list: q.options, correctIndex: q.correct_index },
						// Placeholder: PocketBase's `required` check on number fields
						// treats 0 as blank, so an actual correct_index of 0 (a
						// perfectly valid "first option is correct" answer) always
						// failed to save here. This field is never read back — the
						// real value is in `options.correctIndex` above.
						correct_index: 1,
						explanation: q.explanation,
					})),
				);
			} catch (error) {
				captureFailure('quiz', error, 'save');
			}
		} else {
			captureFailure('quiz', quiz.reason);
		}

		if (mindMap.status === 'fulfilled') {
			try {
				await deleteExisting('mind_maps', lectureId);
				await pocketbaseAdmin.createRecord('mind_maps', {
					lecture: lectureId,
					user: lecture.user,
					structure: mindMap.value,
				});
			} catch (error) {
				captureFailure('mind map', error, 'save');
			}
		} else {
			captureFailure('mind map', mindMap.reason);
		}

		if (failedParts.length === 4) {
			const reason = failureReasons[0] ?? 'All study material generation failed.';
			await setStatus(lectureId, 'failed', userFacingError(reason));
			return;
		}

		await setStatus(
			lectureId,
			'ready',
			failedParts.length > 0
				? `Could not generate: ${failedParts.join(', ')}. ${userFacingError(failureReasons[0] ?? '')}`
				: '',
		);
	} catch (error) {
		const message = error ? describeError(error) : 'Unexpected processing error.';
		logger.error(`processLecture ${lectureId} failed: ${message}`);
		// Best-effort: if the failure above was itself a PocketBase problem (the
		// case this now also covers, since getRecord moved into the try), this
		// write can fail too. Swallow that rather than letting it mask the
		// original error as an unhandled rejection — the stale-state check in
		// api.process-lecture.ts is the backstop that still lets the user retry.
		await setStatus(lectureId, 'failed', userFacingError(message)).catch((statusError) => {
			logger.error(`processLecture ${lectureId}: could not record failure status: ${String(statusError)}`);
		});
	}
}
