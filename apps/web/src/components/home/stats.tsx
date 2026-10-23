import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { STATS } from '@/data/landing';

function Counter({ to, suffix }: { to: number; suffix: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: '-60px' });
	const reduced = useReducedMotion();

	useEffect(() => {
		if (!inView || !ref.current) return;
		if (reduced) {
			ref.current.textContent = to.toLocaleString();
			return;
		}
		const controls = animate(0, to, {
			duration: 2,
			ease: 'easeOut',
			onUpdate: (v) => {
				if (ref.current) ref.current.textContent = Math.round(v).toLocaleString();
			},
		});
		return () => controls.stop();
	}, [inView, to, reduced]);

	return (
		<span>
			<span ref={ref}>0</span>
			{suffix}
		</span>
	);
}

export function Stats() {
	return (
		<section className="py-16 md:py-20">
			<div className="mx-auto max-w-6xl px-4">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: '-60px' }}
					transition={{ duration: 0.6 }}
					className="grid gap-4 rounded-3xl border border-foreground/10 bg-foreground p-8 text-background shadow-[0_6px_0_0_rgba(30,30,36,0.2)] sm:grid-cols-3 md:p-12"
				>
					{STATS.map((stat) => (
						<div key={stat.label} className="text-center">
							<p className="text-4xl font-extrabold tracking-tight md:text-5xl">
								<Counter to={stat.value} suffix={stat.suffix} />
							</p>
							<p className="mt-2 text-sm font-medium text-background/70">{stat.label}</p>
						</div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
