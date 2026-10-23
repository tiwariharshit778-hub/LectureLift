import { Link } from 'react-router';
import { Github, GraduationCap, Instagram, Twitter, Youtube } from 'lucide-react';

const COLUMNS = [
	{
		title: 'Product',
		links: [
			{ label: 'Features', href: '/#features' },
			{ label: 'How it Works', href: '/#how-it-works' },
			{ label: 'Pricing', href: '/#pricing' },
			{ label: 'FAQ', href: '/#faq' },
		],
	},
	{
		title: 'Account',
		links: [
			{ label: 'Sign In', href: '/login' },
			{ label: 'Create Account', href: '/signup' },
			{ label: 'Dashboard', href: '/dashboard' },
		],
	},
	{
		title: 'Legal',
		links: [
			{ label: 'Privacy Policy', href: '/#' },
			{ label: 'Terms of Service', href: '/#' },
			{ label: 'Cookie Policy', href: '/#' },
		],
	},
];

const SOCIALS = [
	{ icon: Twitter, label: 'Twitter' },
	{ icon: Instagram, label: 'Instagram' },
	{ icon: Youtube, label: 'YouTube' },
	{ icon: Github, label: 'GitHub' },
];

export function SiteFooter() {
	return (
		<footer className="border-t border-foreground/10 bg-card/50 py-14">
			<div className="mx-auto max-w-6xl px-4">
				<div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
					<div>
						<Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
							<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
								<GraduationCap className="h-5 w-5" />
							</span>
							LectureLift
						</Link>
						<p className="mt-4 max-w-xs text-sm text-foreground/60">
							Turn any lecture into notes, flashcards, quizzes and mind maps — automatically.
						</p>
						<div className="mt-5 flex gap-2">
							{SOCIALS.map((social) => (
								<a
									key={social.label}
									href="/#"
									aria-label={social.label}
									className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 transition-colors hover:bg-secondary"
								>
									<social.icon className="h-4.5 w-4.5" />
								</a>
							))}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
						{COLUMNS.map((col) => (
							<div key={col.title}>
								<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">{col.title}</p>
								<ul className="mt-4 space-y-2.5">
									{col.links.map((link) => (
										<li key={link.label}>
											<Link to={link.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
												{link.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				<div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-foreground/10 pt-6 text-xs text-muted-foreground sm:flex-row">
					<p>© {new Date().getFullYear()} LectureLift. All rights reserved.</p>
					<p>Made for students who would rather study smart.</p>
				</div>
			</div>
		</footer>
	);
}
