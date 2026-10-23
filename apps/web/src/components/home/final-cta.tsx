import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function FinalCta() {
	return (
		<section className="relative overflow-hidden py-24 md:py-32">
			<div
				aria-hidden
				className="pointer-events-none absolute left-[5%] top-[10%] h-72 w-72 animate-[drift_14s_ease-in-out_infinite] rounded-full bg-[#FFD98F]/60 blur-3xl"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute bottom-[5%] right-[8%] h-80 w-80 animate-[drift_18s_ease-in-out_infinite_reverse] rounded-full bg-[#FFCE73]/50 blur-3xl"
			/>
			<style>{`@keyframes drift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.12); } }`}</style>

			<motion.div
				initial={{ opacity: 0, y: 28 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: '-80px' }}
				transition={{ duration: 0.7 }}
				className="relative mx-auto max-w-3xl px-4 text-center"
			>
				<h2 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
					Your next lecture could already be your study notes
				</h2>
				<p className="mx-auto mt-5 max-w-xl text-lg text-foreground/70">
					Sign up free, upload a recording, and walk into your next exam actually prepared.
				</p>
				<Link
					to="/signup"
					className="mt-9 inline-flex h-14 items-center gap-2 rounded-2xl bg-foreground px-8 text-base font-bold text-background shadow-[0_5px_0_0_rgba(30,30,36,0.3)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
				>
					Get Started Free
					<ArrowRight className="h-5 w-5" />
				</Link>
			</motion.div>
		</section>
	);
}
