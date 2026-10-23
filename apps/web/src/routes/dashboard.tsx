import { Outlet } from 'react-router';
import { requireAuth } from '@/lib/require-auth';
import { Sidebar } from '@/components/dashboard/sidebar';

export function clientLoader() {
	return { user: requireAuth() };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return <div className="min-h-[100dvh]" />;
}

export default function DashboardLayout() {
	return (
		<div className="min-h-[100dvh]">
			<Sidebar />
			<main className="px-4 pb-28 pt-8 sm:px-8 md:pb-12 md:pl-72 md:pr-10">
				<div className="mx-auto w-full max-w-5xl">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
