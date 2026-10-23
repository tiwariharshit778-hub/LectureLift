import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '@/data/landing';
import { cn } from '@/lib/utils';

export function Faq() {
	const [open, setOpen] = useState<number | null>(0);

	return (
		<section id="faq" className="scroll-mt-24 py-20 md:py-28">
			<div className="mx-auto max-w-3xl px-4">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6 }}
					className="text-center"
				>
					<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">FAQ</p>
					<h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
						Questions, answered
					</h2>
				</motion.div>

				<div className="mt-10 space-y-3">
					{FAQS.map((faq, i) => {
						const isOpen = open === i;
						return (
							<motion.div
								key={faq.question}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: '-40px' }}
								transition={{ duration: 0.4, delay: i * 0.06 }}
								className="notebook-card overflow-hidden"
							>
								<button
									onClick={() => setOpen(isOpen ? null : i)}
									className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold"
									aria-expanded={isOpen}
								>
									{faq.question}
									<ChevronDown
										className={cn('h-5 w-5 shrink-0 transition-transform duration-300', isOpen && 'rotate-180')}
									/>
								</button>
								<AnimatePresence initial={false}>
									{isOpen ? (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: 'auto', opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={{ duration: 0.3, ease: 'easeInOut' }}
										>
											<p className="px-6 pb-5 text-sm leading-relaxed text-foreground/70">{faq.answer}</p>
										</motion.div>
									) : null}
								</AnimatePresence>
							</motion.div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
