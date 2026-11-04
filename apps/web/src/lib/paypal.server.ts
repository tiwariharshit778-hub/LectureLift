/**
 * Server-only PayPal Sandbox checkout for the one-time Exam Booster demo.
 *
 * Never import this module from client code: it reads the PayPal client secret
 * and uses PocketBase superuser access to persist verified purchases.
 */
import { apiError } from '@/lib/api.server';
import { resolvePocketBaseUserId } from '@/lib/pocketbase-auth.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import { trustedSiteOrigin } from '@/lib/site-origin.server';

const PAYPAL_API = 'https://api-m.sandbox.paypal.com';
const PURCHASES_COLLECTION = 'paypal_study_kit_purchases';
const PRODUCT_KEY = 'exam-booster-pack';
const AMOUNT = '1.00';
const CURRENCY = 'USD';
const REQUEST_TIMEOUT_MS = 15_000;
const ORDER_APPROVAL_WINDOW_MS = 3 * 60 * 60 * 1000;

type JsonObject = Record<string, unknown>;

class PayPalRequestError extends Error {
	constructor(
		readonly status: number,
		readonly errorName: unknown,
		readonly issueNames: string[],
	) {
		super(`PayPal request failed (HTTP ${status}).`);
	}
}

type StudyKitPurchase = {
	id: string;
	user: string;
	lecture: string;
	order_id: string;
	capture_id: string;
	approval_url: string;
	product_key: string;
	status: string;
	amount: number;
	currency: string;
	booster_status: string;
	created: string;
	booster_output?: unknown;
};

const asObject = (value: unknown): JsonObject | null =>
	value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;

const requiredString = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`PayPal response is missing ${label}.`);
	}

	return value;
};

const requireEnv = (name: string): string => {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is not set.`);
	}

	return value;
};

const getAccessToken = async (): Promise<string> => {
	const credentials = Buffer.from(
		`${requireEnv('PAYPAL_CLIENT_ID')}:${requireEnv('PAYPAL_CLIENT_SECRET')}`,
	).toString('base64');
	const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${credentials}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({ grant_type: 'client_credentials' }),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`PayPal authentication failed (HTTP ${response.status}).`);
	}

	const body = asObject(await response.json());

	return requiredString(body?.access_token, 'an access token');
};

const paypalJson = async (accessToken: string, path: string, init: RequestInit = {}): Promise<JsonObject> => {
	const response = await fetch(`${PAYPAL_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...init.headers,
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		let errorBody: unknown;
		try {
			errorBody = await response.json();
		} catch {
			errorBody = null;
		}
		const errorObject = asObject(errorBody);
		const details = Array.isArray(errorObject?.details) ? errorObject.details : [];
		const issueNames = details
			.map(asObject)
			.map(detail => detail?.issue)
			.filter((issue): issue is string => typeof issue === 'string');

		throw new PayPalRequestError(response.status, errorObject?.name, issueNames);
	}

	const body = asObject(await response.json());

	if (!body) {
		throw new Error('PayPal returned an invalid response.');
	}

	return body;
};

const readPurchaseUnit = (body: JsonObject): JsonObject => {
	if (!Array.isArray(body.purchase_units) || body.purchase_units.length !== 1) {
		throw new Error('PayPal order did not contain exactly one purchase unit.');
	}

	const unit = asObject(body.purchase_units[0]);
	if (!unit) {
		throw new Error('PayPal order contained an invalid purchase unit.');
	}

	return unit;
};

const purchaseMetadata = (purchase: Pick<StudyKitPurchase, 'id' | 'user' | 'lecture' | 'product_key'>): string => {
	const metadata = JSON.stringify({
		purchaseId: purchase.id,
		userId: purchase.user,
		lectureId: purchase.lecture,
		productKey: purchase.product_key,
	});

	if (metadata.length > 127) {
		throw new Error('PayPal purchase metadata exceeds the supported length.');
	}

	return metadata;
};

const verifyOrderDetails = (body: JsonObject, orderId: string, purchase: StudyKitPurchase): JsonObject => {
	if (body.id !== orderId) {
		throw new Error('PayPal returned a different order than requested.');
	}

	const unit = readPurchaseUnit(body);
	const amount = asObject(unit.amount);

	if (
		unit.custom_id !== purchaseMetadata(purchase)
		|| unit.reference_id !== purchase.product_key
		|| amount?.value !== AMOUNT
		|| amount?.currency_code !== CURRENCY
	) {
		throw new Error('PayPal order does not match the authenticated purchase.');
	}

	return unit;
};

const completedCaptureId = (unit: JsonObject): string => {
	const payments = asObject(unit.payments);
	const captures = payments?.captures;

	if (!Array.isArray(captures) || captures.length !== 1) {
		throw new Error('PayPal order did not contain exactly one capture.');
	}

	const capture = asObject(captures[0]);
	const amount = asObject(capture?.amount);

	if (
		capture?.status !== 'COMPLETED'
		|| amount?.value !== AMOUNT
		|| amount?.currency_code !== CURRENCY
	) {
		throw new Error('PayPal capture is not completed for the expected amount and currency.');
	}

	return requiredString(capture.id, 'a capture ID');
};

const saveCompletedPurchase = async (
	purchase: StudyKitPurchase,
	captureId: string,
): Promise<void> => {
	await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
		capture_id: captureId,
		status: 'captured',
	});
};

const isWithinOrderApprovalWindow = (purchase: StudyKitPurchase): boolean | null => {
	const createdAt = Date.parse(purchase.created);
	const now = Date.now();

	if (!Number.isFinite(createdAt) || createdAt > now) {
		return null;
	}

	return now - createdAt < ORDER_APPROVAL_WINDOW_MS;
};

const isPayPalOrderNotFound = (error: unknown): error is PayPalRequestError =>
	error instanceof PayPalRequestError
	&& error.status === 404
	&& (error.errorName === 'RESOURCE_NOT_FOUND' || error.issueNames.includes('ORDER_NOT_FOUND'));

const markPurchaseFailed = async (purchase: StudyKitPurchase): Promise<void> => {
	await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
		status: 'failed',
	});
};

const getExistingApprovalUrl = (purchase: StudyKitPurchase): string => {
	try {
		const approval = new URL(purchase.approval_url);
		if (approval.protocol === 'https:' && approval.hostname === 'www.sandbox.paypal.com') {
			return approval.toString();
		}
	} catch {
		// Treat malformed stored approval URLs as an unusable active order.
	}

	throw apiError(409, 'The existing PayPal order has no valid approval link. Please contact support.');
};

export const createExamBoosterOrder = async (request: Request, lectureId: string) => {
	const userId = await resolvePocketBaseUserId(request);
	if (!/^[a-z0-9]{15}$/.test(lectureId)) {
		throw apiError(422, 'A valid lecture_id is required.');
	}

	const lecture = await pocketbaseAdmin.getRecord<{ id: string; user: string; title: string; status: string }>(
		'lectures',
		lectureId,
	);
	if (lecture.user !== userId) {
		throw apiError(404, 'Lecture not found.');
	}
	if (lecture.status !== 'ready') {
		throw apiError(409, 'The lecture must finish processing before checkout.');
	}

	const transcripts = await pocketbaseAdmin.listRecords<{
		id: string;
		user: string;
		lecture: string;
		segments: { fullText?: unknown } | string;
	}>('transcripts', {
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
		throw apiError(409, 'A saved transcript is required before checkout.');
	}

	const trustedOrigin = trustedSiteOrigin(request);
	const originHeader = request.headers.get('origin');
	if (!originHeader) {
		throw apiError(403, 'Checkout must be started from this site.');
	}
	let requestOrigin: URL;
	try {
		requestOrigin = new URL(originHeader);
	} catch {
		throw apiError(403, 'Checkout must be started from this site.');
	}
	if (
		requestOrigin.origin === 'null'
		|| requestOrigin.username
		|| requestOrigin.password
		|| requestOrigin.pathname !== '/'
		|| requestOrigin.search
		|| requestOrigin.hash
		|| originHeader !== requestOrigin.origin
		|| requestOrigin.origin !== trustedOrigin
	) {
		throw apiError(403, 'Checkout must be started from this site.');
	}

	const priorPurchases = await pocketbaseAdmin.listRecords<StudyKitPurchase>(PURCHASES_COLLECTION, {
		filter: `user = "${userId}" && lecture = "${lectureId}" && product_key = "${PRODUCT_KEY}" && status != "failed"`,
		perPage: 3,
	});
	const priorCaptured = priorPurchases.items.find(purchase => purchase.status === 'captured');
	if (priorCaptured) {
		throw apiError(409, 'This lecture already has a captured Exam Booster purchase.');
	}
	if (priorPurchases.items.some(purchase => purchase.status === 'creating')) {
		throw apiError(409, 'Checkout is already being prepared. Please retry shortly.');
	}
	const priorOrder = priorPurchases.items.find(purchase => purchase.status === 'created' && purchase.order_id);
	if (priorOrder) {
		const accessToken = await getAccessToken();
		let order: JsonObject | null = null;
		try {
			order = await paypalJson(
				accessToken,
				`/v2/checkout/orders/${encodeURIComponent(priorOrder.order_id)}`,
			);
		} catch (error) {
			if (!isPayPalOrderNotFound(error)) {
				throw error;
			}
			await markPurchaseFailed(priorOrder);
		}

		if (order) {
			const unit = verifyOrderDetails(order, priorOrder.order_id, priorOrder);

			if (order.status === 'APPROVED') {
				await captureStudyKitOrder(request, priorOrder.order_id);
				throw apiError(409, 'Your PayPal payment was verified. Check purchase status to access the Exam Booster.');
			}

			if (order.status === 'COMPLETED') {
				await saveCompletedPurchase(priorOrder, completedCaptureId(unit));
				throw apiError(409, 'This PayPal order is already completed. Check purchase status to access the Exam Booster.');
			}

			if (order.status === 'VOIDED' || order.status === 'EXPIRED') {
				await markPurchaseFailed(priorOrder);
			} else if (order.status === 'CREATED') {
				const withinApprovalWindow = isWithinOrderApprovalWindow(priorOrder);
				if (withinApprovalWindow === null) {
					throw apiError(409, 'The existing PayPal order age could not be verified. No new order was created.');
				}
				if (withinApprovalWindow) {
					return {
						orderId: priorOrder.order_id,
						approvalUrl: getExistingApprovalUrl(priorOrder),
						productKey: PRODUCT_KEY,
						amount: AMOUNT,
						currency: CURRENCY,
						purchaseType: 'one-time-sandbox-demo',
					};
				}
				await markPurchaseFailed(priorOrder);
			} else {
				throw apiError(409, 'The existing PayPal order is in an unexpected state. No new order was created.');
			}
		}
	}

	const purchase = await pocketbaseAdmin.createRecord<StudyKitPurchase>(PURCHASES_COLLECTION, {
		user: userId,
		lecture: lectureId,
		order_id: '',
		capture_id: '',
		approval_url: '',
		product_key: PRODUCT_KEY,
		status: 'creating',
		amount: 1,
		currency: CURRENCY,
		booster_status: 'not_started',
	});
	try {
		const lecturePath = `/dashboard/lectures/${encodeURIComponent(lectureId)}`;
		const returnUrl = new URL(`${lecturePath}?paypal=return`, trustedOrigin).toString();
		const cancelUrl = new URL(`${lecturePath}?paypal=cancel`, trustedOrigin).toString();
		const accessToken = await getAccessToken();
		const paypalOrder = await paypalJson(accessToken, '/v2/checkout/orders', {
			method: 'POST',
			headers: { Prefer: 'return=representation' },
			body: JSON.stringify({
				intent: 'CAPTURE',
				purchase_units: [
					{
						reference_id: PRODUCT_KEY,
						custom_id: purchaseMetadata(purchase),
						description: 'One-time Sandbox demo purchase: AI Exam Booster Pack',
						amount: { currency_code: CURRENCY, value: AMOUNT },
					},
				],
				application_context: {
					brand_name: 'LectureLift',
					shipping_preference: 'NO_SHIPPING',
					user_action: 'PAY_NOW',
					return_url: returnUrl,
					cancel_url: cancelUrl,
				},
			}),
		});
		const orderId = requiredString(paypalOrder.id, 'an order ID');
		if (paypalOrder.status !== 'CREATED') {
			throw new Error('PayPal did not create the order.');
		}
		verifyOrderDetails(paypalOrder, orderId, purchase);
		const approvalLink = Array.isArray(paypalOrder.links)
			? paypalOrder.links.map(asObject).find(link => link?.rel === 'approve')
			: undefined;
		const approvalUrl = approvalLink?.href;

		if (typeof approvalUrl !== 'string') {
			throw new Error('PayPal did not return a valid approval URL.');
		}
		const approval = new URL(approvalUrl);
		if (approval.protocol !== 'https:' || approval.hostname !== 'www.sandbox.paypal.com') {
			throw new Error('PayPal returned an unexpected approval URL.');
		}

		await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
			order_id: orderId,
			approval_url: approvalUrl,
			status: 'created',
		});

		return {
			orderId,
			approvalUrl,
			productKey: PRODUCT_KEY,
			amount: AMOUNT,
			currency: CURRENCY,
			purchaseType: 'one-time-sandbox-demo',
		};
	} catch (error) {
		try {
			await pocketbaseAdmin.updateRecord(PURCHASES_COLLECTION, purchase.id, {
				status: 'failed',
			});
		} catch {
			throw new Error('PayPal order creation failed and the pending purchase could not be marked failed.');
		}

		throw error;
	}
};

export const captureStudyKitOrder = async (request: Request, orderId: string) => {
	const userId = await resolvePocketBaseUserId(request);

	if (!/^[A-Za-z0-9-]{1,64}$/.test(orderId)) {
		throw apiError(422, 'A valid order_id is required.');
	}

	const purchases = await pocketbaseAdmin.listRecords<StudyKitPurchase>(PURCHASES_COLLECTION, {
		filter: `order_id = "${orderId}"`,
		perPage: 1,
	});
	const purchase = purchases.items[0];

	if (!purchase || purchase.user !== userId) {
		throw apiError(404, 'Purchase order not found.');
	}

	if (
		purchase.product_key !== PRODUCT_KEY
		|| !purchase.lecture
		|| purchase.amount !== 1
		|| purchase.currency !== CURRENCY
	) {
		throw new Error('Stored purchase does not match the expected demo product.');
	}

	const lecture = await pocketbaseAdmin.getRecord<{ id: string; user: string; status: string }>(
		'lectures',
		purchase.lecture,
	);
	if (lecture.user !== userId || lecture.status !== 'ready') {
		throw apiError(404, 'Purchase lecture not found.');
	}

	if (purchase.status === 'captured' && purchase.capture_id) {
		return {
			orderId,
			captureId: purchase.capture_id,
			status: 'COMPLETED',
			productKey: PRODUCT_KEY,
			lectureId: purchase.lecture,
			purchaseType: 'one-time-sandbox-demo',
			alreadyCaptured: true,
		};
	}

	const accessToken = await getAccessToken();
	const order = await paypalJson(accessToken, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
	const unit = verifyOrderDetails(order, orderId, purchase);
	let captureId: string;

	if (order.status === 'COMPLETED') {
		captureId = completedCaptureId(unit);
	} else if (order.status === 'APPROVED') {
		const captured = await paypalJson(
			accessToken,
			`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
			{
				method: 'POST',
				headers: {
					Prefer: 'return=representation',
					'PayPal-Request-Id': `${orderId}-capture`,
				},
				body: '{}',
			},
		);
		const capturedUnit = verifyOrderDetails(captured, orderId, purchase);

		if (captured.status !== 'COMPLETED') {
			throw apiError(409, 'PayPal has not completed this capture.');
		}

		captureId = completedCaptureId(capturedUnit);
	} else {
		throw apiError(409, 'PayPal order must be approved before it can be captured.');
	}

	await saveCompletedPurchase(purchase, captureId);

	return {
		orderId,
		captureId,
		status: 'COMPLETED',
		productKey: PRODUCT_KEY,
		lectureId: purchase.lecture,
		purchaseType: 'one-time-sandbox-demo',
		alreadyCaptured: false,
	};
};
 