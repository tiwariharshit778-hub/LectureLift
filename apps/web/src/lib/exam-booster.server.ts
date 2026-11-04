import { apiError } from '@/lib/api.server';
import { resolvePocketBaseUserId } from '@/lib/pocketbase-auth.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { generateExamBooster, parseExamBoosterOutput, type ExamBoosterOutput } from '@/lib/pipeline.server';

const PURCHASES_COLLECTION = 'paypal_study_kit_purchases';
const PRODUCT_KEY = 'exam-booster-pack';
const GENERATION_LEASE_MS = 15 * 60 * 1000;

type Purchase = {
	id: string;
	user: string;
	lecture: string;
	product_key: string;
	status: string;
	booster_status: string;
	booster_output?: unknown;
	updated: string;
};

type Transcript = {
	user: string;
	lecture: string;
	segments: { fullText?: unknown } | string;
};

const generationPromises = new Map<string, Promise<ExamBoosterOutput>>();

const isGenerationLeaseExpired = (purchase: Purchase): boolean => {
	const updatedAt = Date.parse(purchase.updated);
	return !Number.isFinite(updatedAt) || Date.now() - updatedAt >= GENERATION_LEASE_MS;
};

const loadTranscript = async (lectureId: string, userId: string): Promise<string> => {
	const transcripts = await pocketbaseAdmin.listRecords<Transcript>('transcripts', {
		filter: `lecture = "${lectureId}"`,
		perPage: 1,
	});
	const transcript = transcripts.items[0];

	if (
		!transcript
		|| transcript.user !== userId
		|| transcript.lecture !== lectureId
		|| !transcript.segments
		|| typeof transcript.segments !== 'object'
		|| typeof transcript.segments.fullText !== 'string'
		|| !transcript.segments.fullText.trim()
	) {
		throw apiError(409, 'A saved transcript is required to generate the Exam Booster.');
	}

	return transcript.segments.fullText;
};

const generateAndPersist = async (purchase: Purchase, transcript: string): Promise<ExamBoosterOutput> => {
	await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
		booster_status: 'generating',
	});

	try {
		const output = await generateExamBooster(transcript);
		await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
			booster_output: output,
			booster_status: 'ready',
		});

		return output;
	} catch {
		try {
			const latest = await pocketbaseAdmin.getRecord<Purchase>(PURCHASES_COLLECTION, purchase.id);
			if (latest.booster_status === 'ready' && latest.booster_output) {
				return parseExamBoosterOutput(latest.booster_output);
			}
			await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
				booster_status: 'failed',
			});
		} catch {
			throw new Error('Exam Booster generation failed and its retry status could not be saved.');
		}

		throw new Error('Exam Booster generation failed. Please retry.');
	}
};

const generateOnce = (purchase: Purchase, transcript: string): Promise<ExamBoosterOutput> => {
	const existing = generationPromises.get(purchase.id);
	if (existing) return existing;

	const generation = generateAndPersist(purchase, transcript);
	generationPromises.set(purchase.id, generation);

	void generation.then(
		() => {
			if (generationPromises.get(purchase.id) === generation) generationPromises.delete(purchase.id);
		},
		() => {
			if (generationPromises.get(purchase.id) === generation) generationPromises.delete(purchase.id);
		},
	);

	return generation;
};

export async function getOrGenerateExamBooster(request: Request, lectureId: string) {
	const userId = await resolvePocketBaseUserId(request);
	if (!/^[a-z0-9]{15}$/.test(lectureId)) {
		throw apiError(422, 'A valid lecture_id is required.');
	}

	const lecture = await pocketbaseAdmin.getRecord<{ id: string; user: string; status: string }>(
		'lectures',
		lectureId,
	);
	if (lecture.user !== userId) {
		throw apiError(404, 'Lecture not found.');
	}
	if (lecture.status !== 'ready') {
		throw apiError(409, 'The lecture must be ready before its Exam Booster can be accessed.');
	}

	const purchases = await pocketbaseAdmin.listRecords<Purchase>(PURCHASES_COLLECTION, {
		filter: `user = "${userId}" && lecture = "${lectureId}" && product_key = "${PRODUCT_KEY}" && status = "captured"`,
		perPage: 1,
	});
	const purchase = purchases.items[0];

	if (!purchase || purchase.user !== userId || purchase.lecture !== lectureId) {
		throw apiError(402, 'A completed Exam Booster purchase is required.');
	}

	if (purchase.booster_status === 'ready') {
		return {
			lectureId,
			productKey: PRODUCT_KEY,
			output: parseExamBoosterOutput(purchase.booster_output),
		};
	}

	if (purchase.booster_status === 'generating' && !generationPromises.has(purchase.id)) {
		if (!isGenerationLeaseExpired(purchase)) {
			throw apiError(409, 'The Exam Booster is already being generated. Please retry shortly.');
		}

		await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
			booster_status: 'failed',
		});
		purchase.booster_status = 'failed';
	}

	if (!['not_started', 'failed', 'generating'].includes(purchase.booster_status)) {
		throw apiError(409, 'The Exam Booster is not available.');
	}

	const transcript = await loadTranscript(lectureId, userId);
	const output = await generateOnce(purchase, transcript);

	return {
		lectureId,
		productKey: PRODUCT_KEY,
		output,
	};
}
