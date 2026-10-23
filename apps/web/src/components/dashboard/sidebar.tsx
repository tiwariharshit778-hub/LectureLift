import { Link, NavLink, useNavigate } from 'react-router';
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Settings, UploadCloud, Zap } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const NAV = [
	{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
	{ to: '/dashboard/upload', label: 'Upload', icon: UploadCloud, end: false },
	{ to: '/dashboard/lectures', label: 'My Lectures', icon: BookOpen, end: false },
	{ to: '/dashboard/study', label: 'Study', icon: Zap, end: false },
	{ to: '/dashboard/settings', label: 'Settings', icon: Settings, end: false },
];

export function Sidebar() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const signOut = () => {
		pb.authStore.clear();
		navigate('/login');
	};

	const avatarUrl = user?.avatar ? pb.files.getURL(user, user.avatar, { thumb: '100x100' }) : null;
	const initials = (user?.name || user?.email || '?')
		.split(' ')
		.map((part: string) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	return (
		<>
			{/* Desktop sidebar */}
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-foreground/10 bg-card/60 backdrop-blur-sm md:flex">
				<Link to="/" className="flex items-center gap-2 px-6 py-6 font-extrabold tracking-tight">
					<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
						<GraduationCap className="h-5 w-5" />
					</span>
					LectureLift
				</Link>

				<nav className="flex-1 space-y-1 px-3">
					{NAV.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							className={({ isActive }) =>
								cn(
									'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
									isActive
										? 'bg-foreground text-background shadow-[0_3px_0_0_rgba(30,30,36,0.2)]'
										: 'text-foreground/70 hover:bg-secondary hover:text-foreground',
								)
							}
						>
							<item.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
							{item.label}
						</NavLink>
					))}
				</nav>

				<div className="border-t border-foreground/10 p-4">
					<div className="flex items-center gap-3">
						{avatarUrl ? (
							<img src={avatarUrl} alt="" className="h-10 w-10 rounded-full border border-foreground/15 object-cover" />
						) : (
							<span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-extrabold">
								{initials}
							</span>
						)}
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-bold">{user?.name || 'Student'}</p>
							<p className="truncate text-xs text-muted-foreground">{user?.email}</p>
						</div>
						<button
							onClick={signOut}
							aria-label="Sign out"
							className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
						>
							<LogOut className="h-4 w-4" />
						</button>
					</div>
				</div>
			</aside>

			{/* Mobile bottom bar */}
			<nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-foreground/10 bg-card/90 px-2 py-2 backdrop-blur-md md:hidden">
				{NAV.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							cn(
								'flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-bold transition-colors',
								isActive ? 'bg-foreground text-background' : 'text-foreground/60',
							)
						}
					>
						<item.icon className="h-5 w-5" strokeWidth={2.2} />
						{item.label}
					</NavLink>
				))}
			</nav>
		</>
	);
}
