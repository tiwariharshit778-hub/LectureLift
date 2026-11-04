import { apiError, readJsonBody, withApi } from '@/lib/api.server';
import { captureStudyKitOrder } from '@/lib/paypal.server';

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') {
		return apiError(405, 'Method not allowed.');
	}

	const body = await readJsonBody<{ order_id?: unknown }>(request);

	if (typeof body.order_id !== 'string') {
		return apiError(422, 'order_id is required.');
	}

	return captureStudyKitOrder(request, body.order_id);
});
