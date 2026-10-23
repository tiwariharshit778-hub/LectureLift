import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { TESTIMONIALS } from '@/data/landing';

export function Testimonials() {
	return (
		<section className="py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6 }}
					className="max-w-2xl"
				>
					<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">Testimonials</p>
					<h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
						Students study less and remember more
					</h2>
				</motion.div>

				<div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{TESTIMONIALS.map((t, i) => (
						<motion.figure
							key={t.name}
							initial={{ opacity: 0, y: 28 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-60px' }}
							transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
							className="notebook-card flex flex-col p-6 transition-transform duration-300 hover:-translate-y-1"
						>
							<Quote className="h-6 w-6 text-foreground/30" />
							<blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
								{t.quote}
							</blockquote>
							<figcaption className="mt-5 flex items-center gap-3 border-t border-foreground/10 pt-4">
								<span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-extrabold">
									{t.name.split(' ').map((n) => n[0]).join('')}
								</span>
								<div>
									<p className="text-sm font-bold">{t.name}</p>
									<p className="text-xs text-muted-foreground">{t.role}</p>
								</div>
							</figcaption>
						</motion.figure>
					))}
				</div>
			</div>
		</section>
	);
}
