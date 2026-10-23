import { useState } from 'react';
import { Link, redirect, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import type { Route } from './+types/signup';
import { seo } from '@/lib/seo';
import pb from '@/lib/pocketbase-client';
import { AuthError, AuthLayout, GoogleButton, describeAuthError, inputClass, submitClass } from '@/components/auth/auth-layout';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo({ matches, location }, { title: 'Create Account — LectureLift', description: 'Sign up for LectureLift and turn your first lecture into study materials.' });
}

export function clientLoader() {
	if (pb.authStore.isValid) throw redirect('/dashboard');
	return null;
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return <div className="min-h-[100dvh]" />;
}

export default function Signup() {
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password.length < 10) {
			setError('Password must be at least 10 characters long.');
			return;
		}
		if (password !== confirm) {
			setError('Passwords do not match.');
			return;
		}
		setLoading(true);
		// Two steps, reported separately: an account can be created fine and then
		// fail to sign in (e.g. the auth call blocked), which reads very
		// differently from the create itself failing.
		try {
			await pb.collection('users').create({ email, password, passwordConfirm: confirm, name });
		} catch (err) {
			setError(describeAuthError(err, 'Could not create your account.'));
			setLoading(false);
			return;
		}
		try {
			await pb.collection('users').authWithPassword(email, password);
			navigate('/dashboard');
		} catch (err) {
			setError(describeAuthError(err, 'Your account was created, but signing in failed. Try the Sign in page.'));
			setLoading(false);
		}
	};

	return (
		<AuthLayout
			title="Create your account"
			subtitle="Free plan included — upload your first lecture in minutes."
			footer={
				<span>
					Already have an account?{' '}
					<Link to="/login" className="font-bold text-foreground underline-offset-4 hover:underline">
						Sign in
					</Link>
				</span>
			}
		>
			<form onSubmit={onSubmit} className="space-y-4">
				<AuthError message={error} />
				<div className="space-y-2">
					<label htmlFor="name" className="text-sm font-semibold">Full name</label>
					<input
						id="name" type="text" required autoComplete="name"
						value={name} onChange={(e) => setName(e.target.value)}
						placeholder="Ada Lovelace" className={inputClass}
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor="email" className="text-sm font-semibold">Email</label>
					<input
						id="email" type="email" required autoComplete="email"
						value={email} onChange={(e) => setEmail(e.target.value)}
						placeholder="you@university.edu" className={inputClass}
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor="password" className="text-sm font-semibold">Password</label>
					<input
						id="password" type="password" required autoComplete="new-password"
						value={password} onChange={(e) => setPassword(e.target.value)}
						placeholder="At least 10 characters" className={inputClass}
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor="confirm" className="text-sm font-semibold">Confirm password</label>
					<input
						id="confirm" type="password" required autoComplete="new-password"
						value={confirm} onChange={(e) => setConfirm(e.target.value)}
						placeholder="Repeat your password" className={inputClass}
					/>
				</div>
				<button type="submit" disabled={loading} className={submitClass}>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Create Account
				</button>
			</form>
			<div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
				<span className="h-px flex-1 bg-foreground/10" />or<span className="h-px flex-1 bg-foreground/10" />
			</div>
			<GoogleButton onError={setError} />
		</AuthLayout>
	);
}
