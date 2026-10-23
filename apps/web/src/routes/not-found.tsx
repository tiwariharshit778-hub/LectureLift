import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import type { Route } from './+types/not-found';
import { seo } from '@/lib/seo';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo({ matches, location }, { title: 'Page Not Found — LectureLift', description: 'This page does not exist.' });
}

export default function NotFound() {
	return (
		<div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
			<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
				<GraduationCap className="h-7 w-7" />
			</span>
			<p className="mt-8 text-7xl font-extrabold tracking-tight">404</p>
			<h1 className="mt-3 text-xl font-extrabold">This page skipped the lecture</h1>
			<p className="mt-2 max-w-sm text-sm text-muted-foreground">
				The page you are looking for does not exist or was moved.
			</p>
			<Link
				to="/"
				className="mt-8 inline-flex h-12 items-center rounded-xl bg-foreground px-6 text-sm font-bold text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
			>
				Back to home
			</Link>
		</div>
	);
}
