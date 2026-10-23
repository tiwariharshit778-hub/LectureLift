import { Link } from 'react-router';
import { GraduationCap, Loader2 } from 'lucide-react';
import { ClientResponseError } from 'pocketbase';
import pb from '@/lib/pocketbase-client';
import { useState } from 'react';

/**
 * Turns a failed auth call into a message that says what actually went wrong.
 * Login/signup used to catch and replace every error with one fixed sentence
 * ("Invalid email or password", "Could not create your account…"), so a
 * network/proxy failure (e.g. a freshly connected custom domain that doesn't
 * route the PocketBase proxy path yet) looked identical to a typo'd password
 * and couldn't be diagnosed. Field-level validation errors from PocketBase
 * live in `.response.data`, not `.message`.
 */
export function describeAuthError(error: unknown, fallback: string): string {
	console.error('Auth request failed:', error);
	if (error instanceof ClientResponseError) {
		if (error.status === 0) {
			return `Could not reach the server (network error). If you just connected a custom domain, its routing may not be live yet. ${error.isAbort ? '(request was aborted)' : ''}`.trim();
		}
		const fields = error.response?.data as Record<string, { message?: string }> | undefined;
		const fieldMessages = fields
			? Object.entries(fields).map(([field, info]) => `${field}: ${info?.message ?? 'invalid'}`)
			: [];
		const detail = fieldMessages.length > 0 ? fieldMessages.join('; ') : error.message;
		return `${fallback} (${error.status}: ${detail})`;
	}
	return `${fallback} (${error instanceof Error ? error.message : String(error)})`;
}

export function AuthLayout({
	title,
	subtitle,
	children,
	footer,
}: {
	title: string;
	subtitle: string;
	children: React.ReactNode;
	footer: React.ReactNode;
}) {
	return (
		<div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
			<Link to="/" className="mb-8 flex items-center gap-2 text-lg font-extrabold tracking-tight">
				<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
					<GraduationCap className="h-5 w-5" />
				</span>
				LectureLift
			</Link>

			<div className="notebook-card w-full max-w-md p-8">
				<h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
				<div className="mt-7">{children}</div>
			</div>

			<div className="mt-6 text-sm text-muted-foreground">{footer}</div>
		</div>
	);
}

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
	const [loading, setLoading] = useState(false);

	const signInWithGoogle = async () => {
		setLoading(true);
		try {
			await pb.collection('users').authWithOAuth2({ provider: 'google' });
			window.location.href = '/dashboard';
		} catch {
			onError('Google sign-in is not configured yet. Please use email and password.');
			setLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={signInWithGoogle}
			disabled={loading}
			className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-foreground/15 bg-card text-sm font-bold transition-colors hover:bg-secondary disabled:opacity-60"
		>
			{loading ? (
				<Loader2 className="h-4 w-4 animate-spin" />
			) : (
				<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
					<path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.72 12 .72 7.44.72 3.56 3.42 1.72 7.32l3.66 2.84C6.26 7.14 8.88 5.04 12 5.04z" />
					<path fill="#4285F4" d="M23.28 12.26c0-.8-.08-1.56-.2-2.3H12v4.52h6.34c-.28 1.48-1.1 2.74-2.34 3.58l3.6 2.8c2.1-1.94 3.68-4.8 3.68-8.6z" />
					<path fill="#FBBC05" d="M5.38 14.34a7.1 7.1 0 0 1 0-4.68L1.72 6.82a11.28 11.28 0 0 0 0 10.36l3.66-2.84z" />
					<path fill="#34A853" d="M12 23.28c3.04 0 5.6-1 7.46-2.72l-3.6-2.8c-1 .68-2.28 1.08-3.86 1.08-3.12 0-5.74-2.1-6.62-5.12l-3.66 2.84c1.84 3.9 5.72 6.72 10.28 6.72z" />
				</svg>
			)}
			Continue with Google
		</button>
	);
}

export function AuthError({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
			{message}
		</p>
	);
}

export const inputClass =
	'h-11 w-full rounded-xl border border-foreground/15 bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10';

export const submitClass =
	'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0';
