import PocketBase from 'pocketbase';
import type { Route } from './+types/api.process-lecture';
import { apiError, readJsonBody, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { processLecture, type PrecomputedTranscript } from '@/lib/pipeline.server';
import logger from '@/lib/logger.server';

/**
 * How long a lecture may sit in "transcribing"/"generating" before a retry
 * request is allowed to treat it as abandoned rather than still in flight.
 * Must stay above the worst case a legitimate run can take: transcription can
 * try up to two providers, each with its own `TRANSCRIBE_TIMEOUT_MS` (20 min,
 * see pipeline.server.ts) before falling through, plus generation on top — set
 * this any lower and a long-but-still-running lecture gets treated as
 * abandoned and raced by a premature retry.
 */
const STALE_PROCESSING_MS = 50 * 60 * 1000;

export const action = (args: Route.ActionArgs) =>
	withApi(async ({ request }) => {
		const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
		if (!token) return apiError(401, 'Sign in required.');

		const body = await readJsonBody<{
			lecture_id?: unknown;
			transcript?: unknown;
		}>(request);
		const lectureId = typeof body.lecture_id === 'string' ? body.lecture_id : '';
		if (!lectureId) return apiError(422, 'lecture_id is required.');

		// Verify the caller's JWT against PocketBase.
		const userClient = new PocketBase(process.env.POCKETBASE_URL || 'http://localhost:8090');
		userClient.authStore.save(token, null);
		let userId: string;
		try {
			const auth = await userClient.collection('users').authRefresh();
			userId = auth.record.id;
		} catch {
			return apiError(401, 'Session expired. Please sign in again.');
		}

		const lecture = await pocketbaseAdmin.getRecord<{ user: string; status: string; updated: string }>(
			'lectures',
			lectureId,
		);
		if (lecture.user !== userId) return apiError(403, 'This lecture does not belong to you.');

		const isActive = lecture.status === 'transcribing' || lecture.status === 'generating';
		if (isActive) {
			// `processLecture` runs fire-and-forget with no persisted job state, so a
			// server restart, crash, or OOM while a lecture is mid-pipeline leaves it
			// wedged at "transcribing"/"generating" forever — nothing ever times it
			// out. Left unguarded, this branch would then block every future retry
			// with 409 indefinitely, and the UI only ever offers a Retry button for
			// status "failed", so the lecture becomes permanently unrecoverable.
			// `updated` bumps on every real status write, so treat one that hasn't
			// moved in a while as abandoned and let it be reprocessed instead.
			const staleMs = Date.now() - new Date(lecture.updated).getTime();
			if (staleMs < STALE_PROCESSING_MS) {
				return apiError(409, 'This lecture is already being processed.');
			}
			logger.warn(
				`Lecture ${lectureId} stuck in "${lecture.status}" for ${Math.round(staleMs / 1000)}s — treating as abandoned and reprocessing.`,
			);
		}

		// Optional client-side transcript (from Transformers.js). Validate shape.
		let precomputed: PrecomputedTranscript | undefined;
		const t = body.transcript;
		if (t && typeof t === 'object') {
			const candidate = t as { text?: unknown; segments?: unknown; duration?: unknown };
			if (typeof candidate.text === 'string' && candidate.text.trim()) {
				const segments = Array.isArray(candidate.segments)
					? candidate.segments
							.filter((s): s is { start?: number; end?: number; text?: string } => !!s && typeof s === 'object')
							.map((s) => ({
								start: typeof s.start === 'number' ? s.start : 0,
								end: typeof s.end === 'number' ? s.end : 0,
								text: typeof s.text === 'string' ? s.text : '',
							}))
					: [];
				precomputed = {
					text: candidate.text,
					segments,
					duration: typeof candidate.duration === 'number' ? candidate.duration : null,
				};
			}
		}

		// Fire and forget: the client watches status changes over realtime.
		void processLecture(lectureId, precomputed).catch((error) => {
			logger.error(`processLecture crashed for ${lectureId}: ${String(error)}`);
		});

		return Response.json(
			{ ok: true, status: 'processing', source: precomputed ? 'local' : 'api' },
			{ status: 202 },
		);
	})(args);
