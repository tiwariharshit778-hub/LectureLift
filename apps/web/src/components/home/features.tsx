import { motion } from 'framer-motion';
import { FEATURES } from '@/data/landing';
import { cn } from '@/lib/utils';

function FlashcardAnimation() {
	return (
		<div className="mt-4 flex h-28 items-center justify-center [perspective:600px]">
			<div className="relative h-24 w-40 animate-[flip_4s_ease-in-out_infinite] [transform-style:preserve-3d]">
				<div className="absolute inset-0 flex items-center justify-center rounded-xl border border-foreground/15 bg-background px-3 text-center text-xs font-bold [backface-visibility:hidden]">
					What is the powerhouse of the cell?
				</div>
				<div className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground px-3 text-center text-xs font-bold text-background [backface-visibility:hidden] [transform:rotateY(180deg)]">
					The mitochondria
				</div>
			</div>
			<style>{`@keyframes flip { 0%,35% { transform: rotateY(0deg); } 50%,85% { transform: rotateY(180deg); } 100% { transform: rotateY(360deg); } }`}</style>
		</div>
	);
}

function MindMapAnimation() {
	return (
		<div className="mt-4 flex h-28 items-center justify-center">
			<svg viewBox="0 0 200 90" className="h-full w-full max-w-[220px]">
				<line x1="100" y1="45" x2="40" y2="18" stroke="#1E1E24" strokeOpacity="0.25" strokeWidth="2" />
				<line x1="100" y1="45" x2="40" y2="72" stroke="#1E1E24" strokeOpacity="0.25" strokeWidth="2" />
				<line x1="100" y1="45" x2="162" y2="30" stroke="#1E1E24" strokeOpacity="0.25" strokeWidth="2" />
				<line x1="100" y1="45" x2="162" y2="62" stroke="#1E1E24" strokeOpacity="0.25" strokeWidth="2" />
				<circle cx="40" cy="18" r="9" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.3" />
				<circle cx="40" cy="72" r="9" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.3" />
				<circle cx="162" cy="30" r="9" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.3" />
				<circle cx="162" cy="62" r="9" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.3" />
				<circle cx="100" cy="45" r="14" fill="#1E1E24">
					<animate attributeName="r" values="14;17;14" dur="2.4s" repeatCount="indefinite" />
				</circle>
				<circle cx="100" cy="45" r="20" fill="none" stroke="#1E1E24" strokeOpacity="0.3">
					<animate attributeName="r" values="16;26" dur="2.4s" repeatCount="indefinite" />
					<animate attributeName="stroke-opacity" values="0.35;0" dur="2.4s" repeatCount="indefinite" />
				</circle>
			</svg>
		</div>
	);
}

export function Features() {
	return (
		<section id="features" className="scroll-mt-24 py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6 }}
					className="max-w-2xl"
				>
					<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">Features</p>
					<h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
						Everything a lecture hides, unpacked for you
					</h2>
					<p className="mt-4 text-foreground/70">
						One upload becomes a complete study kit — built from your actual lecture, not a generic summary.
					</p>
				</motion.div>

				<div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{FEATURES.map((feature, i) => {
						const Icon = feature.icon;
						const large = feature.size === 'large';
						return (
							<motion.div
								key={feature.title}
								initial={{ opacity: 0, y: 28 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: '-60px' }}
								transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
								className={cn(
									'notebook-card group p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_0_0_rgba(30,30,36,0.12)]',
									large && 'sm:col-span-2',
								)}
							>
								<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
									<Icon className="h-5 w-5" strokeWidth={2} />
								</span>
								<h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-foreground/70">{feature.description}</p>
								{feature.title === 'Flashcards' ? <FlashcardAnimation /> : null}
								{feature.title === 'Smart Transcription' ? <MindMapAnimation /> : null}
							</motion.div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
