import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2, MailCheck } from 'lucide-react';
import type { Route } from './+types/forgot-password';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { AuthError, AuthLayout, inputClass, submitClass } from '@/components/auth/auth-layout';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo({ matches, location }, { title: 'Reset Password — LectureLift', description: 'Request a password reset link for your LectureLift account.' });
}

export default function ForgotPassword() {
	const [email, setEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await pb.collection('users').requestPasswordReset(email);
			setSent(true);
		} catch {
			setError('Could not send the reset email. Check the address and try again.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout
			title="Reset your password"
			subtitle="We will email you a secure reset link."
			footer={
				<span>
					Remembered it?{' '}
					<Link to="/login" className="font-bold text-foreground underline-offset-4 hover:underline">
						Back to sign in
					</Link>
				</span>
			}
		>
			{sent ? (
				<div className="rounded-xl border border-foreground/10 bg-secondary/60 p-5 text-center">
					<MailCheck className="mx-auto h-8 w-8" />
					<p className="mt-3 text-sm font-semibold">Check your inbox</p>
					<p className="mt-1 text-sm text-foreground/70">
						If an account exists for {email}, a reset link is on its way. Follow it to choose a new password.
					</p>
				</div>
			) : (
				<form onSubmit={onSubmit} className="space-y-4">
					<AuthError message={error} />
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-semibold">Email</label>
						<input
							id="email" type="email" required autoComplete="email"
							value={email} onChange={(e) => setEmail(e.target.value)}
							placeholder="you@university.edu" className={inputClass}
						/>
					</div>
					<button type="submit" disabled={loading} className={submitClass}>
						{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						Send Reset Link
					</button>
				</form>
			)}
		</AuthLayout>
	);
}
