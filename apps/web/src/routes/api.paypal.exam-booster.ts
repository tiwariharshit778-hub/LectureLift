import { apiError, readJsonBody, withApi } from '@/lib/api.server';
import { getOrGenerateExamBooster } from '@/lib/exam-booster.server';

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') {
		return apiError(405, 'Method not allowed.');
	}

	const body: unknown = await readJsonBody(request);
	if (
		!body
		|| typeof body !== 'object'
		|| Array.isArray(body)
		|| Object.keys(body).length !== 1
		|| typeof (body as { lecture_id?: unknown }).lecture_id !== 'string'
	) {
		return apiError(422, 'Only lecture_id is accepted.');
	}

	return getOrGenerateExamBooster(request, (body as { lecture_id: string }).lecture_id);
});
