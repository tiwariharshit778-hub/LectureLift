import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { GraduationCap, Menu, X } from 'lucide-react';
import { NAV_LINKS } from '@/data/landing';
import { cn } from '@/lib/utils';

export function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 24);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	return (
		<header
			className={cn(
				'fixed inset-x-0 top-0 z-50 transition-all duration-300',
				scrolled ? 'py-2' : 'py-4',
			)}
		>
			<div className="mx-auto max-w-6xl px-4">
				<nav
					className={cn(
						'flex items-center justify-between rounded-2xl border border-foreground/10 bg-card/70 px-4 backdrop-blur-md transition-all duration-300',
						scrolled ? 'py-2 shadow-[0_4px_0_0_rgba(30,30,36,0.08)]' : 'py-3',
					)}
				>
					<Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
							<GraduationCap className="h-5 w-5" strokeWidth={2} />
						</span>
						LectureLift
					</Link>

					<div className="hidden items-center gap-1 md:flex">
						{NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
							>
								{link.label}
							</a>
						))}
					</div>

					<div className="hidden items-center gap-2 md:flex">
						<Link
							to="/login"
							className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
						>
							Sign In
						</Link>
						<Link
							to="/signup"
							className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
						>
							Get Started
						</Link>
					</div>

					<button
						className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary md:hidden"
						onClick={() => setOpen((v) => !v)}
						aria-label="Toggle menu"
					>
						{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</nav>

				{open ? (
					<div className="mt-2 rounded-2xl border border-foreground/10 bg-card/95 p-3 backdrop-blur-md md:hidden">
						{NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setOpen(false)}
								className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
							>
								{link.label}
							</a>
						))}
						<div className="mt-2 flex gap-2 border-t border-foreground/10 pt-3">
							<Link to="/login" className="flex-1 rounded-xl border border-foreground/15 px-4 py-2.5 text-center text-sm font-semibold">
								Sign In
							</Link>
							<Link to="/signup" className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-center text-sm font-semibold text-background">
								Get Started
							</Link>
						</div>
					</div>
				) : null}
			</div>
		</header>
	);
}
