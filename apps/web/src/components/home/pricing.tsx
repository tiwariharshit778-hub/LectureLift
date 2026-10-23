import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PRICING } from '@/data/landing';
import { cn } from '@/lib/utils';

export function Pricing() {
	const [yearly, setYearly] = useState(false);
	const plans = yearly ? PRICING.yearly : PRICING.monthly;

	return (
		<section id="pricing" className="scroll-mt-24 py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6 }}
					className="mx-auto max-w-2xl text-center"
				>
					<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">Pricing</p>
					<h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
						Cheaper than one tutoring hour
					</h2>
					<div className="mt-8 inline-flex items-center rounded-full border border-foreground/15 bg-card/70 p-1">
						{(['Monthly', 'Yearly'] as const).map((label) => {
							const active = yearly === (label === 'Yearly');
							return (
								<button
									key={label}
									onClick={() => setYearly(label === 'Yearly')}
									className={cn(
										'relative rounded-full px-5 py-2 text-sm font-bold transition-colors',
										active ? 'text-background' : 'text-foreground/60 hover:text-foreground',
									)}
								>
									{active ? (
										<motion.span
											layoutId="billing-pill"
											className="absolute inset-0 rounded-full bg-foreground"
											transition={{ type: 'spring', stiffness: 400, damping: 32 }}
										/>
									) : null}
									<span className="relative z-10">
										{label}
										{label === 'Yearly' ? <span className="ml-1.5 text-xs opacity-80">−25%</span> : null}
									</span>
								</button>
							);
						})}
					</div>
				</motion.div>

				<div className="mt-12 grid gap-4 md:grid-cols-3">
					{plans.map((plan, i) => (
						<motion.div
							key={plan.name}
							initial={{ opacity: 0, y: 28 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-60px' }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
							className={cn(
								'notebook-card relative flex flex-col p-7',
								plan.highlighted && 'border-2 border-foreground bg-card shadow-[0_8px_0_0_rgba(30,30,36,0.15)] md:-translate-y-2',
							)}
						>
							{plan.highlighted ? (
								<span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3.5 py-1 text-xs font-bold text-background">
									Most popular
								</span>
							) : null}
							<h3 className="text-lg font-extrabold">{plan.name}</h3>
							<p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
							<p className="mt-5">
								<span className="text-5xl font-extrabold tracking-tight">${plan.price}</span>
								<span className="ml-1 text-sm font-medium text-muted-foreground">
									/ month{yearly && plan.price > 0 ? ', billed yearly' : ''}
								</span>
							</p>
							<ul className="mt-6 flex-1 space-y-2.5">
								{plan.features.map((feature) => (
									<li key={feature} className="flex items-start gap-2.5 text-sm">
										<Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} />
										{feature}
									</li>
								))}
							</ul>
							<Link
								to="/signup"
								className={cn(
									'mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.98]',
									plan.highlighted
										? 'bg-foreground text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)]'
										: 'border-2 border-foreground/15 hover:bg-secondary',
								)}
							>
								{plan.cta}
							</Link>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
