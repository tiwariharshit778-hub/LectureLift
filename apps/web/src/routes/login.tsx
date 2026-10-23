import { useState } from 'react';
import { Link, redirect, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import type { Route } from './+types/login';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { AuthError, AuthLayout, GoogleButton, describeAuthError, inputClass, submitClass } from '@/components/auth/auth-layout';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo({ matches, location }, { title: 'Sign In — LectureLift', description: 'Sign in to your LectureLift dashboard.' });
}

export function clientLoader() {
	if (pb.authStore.isValid) throw redirect('/dashboard');
	return null;
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return <div className="min-h-[100dvh]" />;
}

export default function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await pb.collection('users').authWithPassword(email, password);
			navigate('/dashboard');
		} catch (err) {
			setError(describeAuthError(err, 'Could not sign in. Check your email and password.'));
			setLoading(false);
		}
	};

	return (
		<AuthLayout
			title="Welcome back"
			subtitle="Sign in to keep studying where you left off."
			footer={
				<span>
					New to LectureLift?{' '}
					<Link to="/signup" className="font-bold text-foreground underline-offset-4 hover:underline">
						Create an account
					</Link>
				</span>
			}
		>
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
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label htmlFor="password" className="text-sm font-semibold">Password</label>
						<Link to="/forgot-password" className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline">
							Forgot password?
						</Link>
					</div>
					<input
						id="password" type="password" required autoComplete="current-password"
						value={password} onChange={(e) => setPassword(e.target.value)}
						placeholder="Your password" className={inputClass}
					/>
				</div>
				<button type="submit" disabled={loading} className={submitClass}>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Sign In
				</button>
			</form>
			<div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
				<span className="h-px flex-1 bg-foreground/10" />or<span className="h-px flex-1 bg-foreground/10" />
			</div>
			<GoogleButton onError={setError} />
		</AuthLayout>
	);
}
