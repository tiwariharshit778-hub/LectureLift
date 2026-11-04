import { apiError } from '@/lib/api.server';

const SESSION_TIMEOUT_MS = 15_000;

export async function resolvePocketBaseUserId(request: Request): Promise<string> {
	const authorization = request.headers.get('authorization') ?? '';
	const tokenMatch = /^Bearer\s+(\S+)$/i.exec(authorization);

	if (!tokenMatch) {
		throw apiError(401, 'Sign in required.');
	}

	const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';
	let response: Response;
	try {
		response = await fetch(`${pocketbaseUrl}/api/collections/users/auth-refresh`, {
			method: 'POST',
			headers: { Authorization: tokenMatch[1] },
			signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
		});
	} catch {
		throw new Error('Could not reach PocketBase to verify the session.');
	}

	if (!response.ok) {
		throw apiError(401, 'Your session has expired. Please sign in again.');
	}

	const body: unknown = await response.json();
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw apiError(401, 'Your session has expired. Please sign in again.');
	}

	const record = (body as { record?: unknown }).record;
	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		throw apiError(401, 'Your session has expired. Please sign in again.');
	}

	const userId = (record as { id?: unknown }).id;
	if (typeof userId !== 'string' || !userId) {
		throw apiError(401, 'Your session has expired. Please sign in again.');
	}

	return userId;
}
