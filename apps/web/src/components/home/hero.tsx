import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileAudio, Loader2, Sparkles, UploadCloud } from 'lucide-react';

const STAGES = [
	{ label: 'Uploading lecture.mp3', icon: UploadCloud },
	{ label: 'Transcribing audio…', icon: FileAudio },
	{ label: 'Generating study materials…', icon: Sparkles },
	{ label: 'Done — ready to study!', icon: CheckCircle2 },
];

function UploadWidgetMockup() {
	const [stage, setStage] = useState(0);

	useEffect(() => {
		const id = window.setInterval(() => setStage((s) => (s + 1) % STAGES.length), 2200);
		return () => window.clearInterval(id);
	}, []);

	const progress = [28, 52, 82, 100][stage];
	const Icon = STAGES[stage].icon;

	return (
		<div className="notebook-card w-full max-w-md p-6">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold">New lecture</p>
				<span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">MP3 · 48 min</span>
			</div>

			<div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 bg-background/60 p-4">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
					<FileAudio className="h-5 w-5" />
				</span>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">BIO-201 — Cell Respiration.mp3</p>
					<p className="text-xs text-muted-foreground">41.2 MB · uploaded just now</p>
				</div>
			</div>

			<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
				<div
					className="h-full rounded-full bg-foreground transition-all duration-700 ease-out"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="mt-4 flex items-center gap-2">
				<AnimatePresence mode="wait">
					<motion.span
						key={stage}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.25 }}
						className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
					>
						{stage === 3 ? (
							<Icon className="h-3.5 w-3.5" />
						) : (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						)}
						{STAGES[stage].label}
					</motion.span>
				</AnimatePresence>
			</div>

			<div className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
				{['Notes', 'Cards', 'Quiz', 'Map'].map((label, i) => (
					<div
						key={label}
						className={`rounded-lg border border-foreground/10 py-2 transition-colors duration-500 ${
							stage === 3 || stage > i ? 'bg-secondary text-foreground' : 'text-muted-foreground'
						}`}
					>
						{label}
					</div>
				))}
			</div>
		</div>
	);
}

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.12 } },
};

const item = {
	hidden: { opacity: 0, y: 24 },
	show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export function Hero() {
	return (
		<section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
			<div
				aria-hidden
				className="pointer-events-none absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-[#FFD98F]/50 blur-3xl"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute bottom-[-20%] left-[-8%] h-80 w-80 rounded-full bg-[#FFCE73]/40 blur-3xl"
			/>

			<div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-[1.1fr_0.9fr]">
				<motion.div variants={container} initial="hidden" animate="show">
					<motion.span
						variants={item}
						className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card/70 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider"
					>
						<Sparkles className="h-3.5 w-3.5" />
						AI study assistant for students
					</motion.span>

					<motion.h1
						variants={item}
						className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
					>
						Turn Any Lecture Into Notes, Flashcards &amp; Quizzes,{' '}
						<span className="relative inline-block">
							Automatically
							<svg
								aria-hidden
								viewBox="0 0 220 12"
								className="absolute -bottom-1 left-0 w-full"
								preserveAspectRatio="none"
							>
								<path
									d="M3 9 C 60 3, 160 3, 217 8"
									fill="none"
									stroke="#F0A833"
									strokeWidth="5"
									strokeLinecap="round"
								/>
							</svg>
						</span>
					</motion.h1>

					<motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/70">
						Upload a lecture recording and LectureLift transcribes it, then builds revision notes,
						flashcards, a quiz and a mind map — while you make a coffee.
					</motion.p>

					<motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
						<Link
							to="/signup"
							className="inline-flex h-12 items-center gap-2 rounded-xl bg-foreground px-6 text-sm font-bold text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
						>
							Try it Free
							<ArrowRight className="h-4 w-4" />
						</Link>
						<a
							href="#how-it-works"
							className="inline-flex h-12 items-center rounded-xl border-2 border-foreground/15 bg-card/60 px-6 text-sm font-bold transition-colors hover:bg-secondary"
						>
							See How it Works
						</a>
					</motion.div>

					<motion.p variants={item} className="mt-5 text-xs font-medium text-muted-foreground">
						Free plan · No credit card · MP3 &amp; MP4 up to 100 MB
					</motion.p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 32, rotate: 2 }}
					animate={{ opacity: 1, y: 0, rotate: 0 }}
					transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
					className="flex justify-center md:justify-end"
				>
					<UploadWidgetMockup />
				</motion.div>
			</div>
		</section>
	);
}
