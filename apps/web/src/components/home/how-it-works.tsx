import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { FileAudio, FileText, Layers, ListChecks, Network, UploadCloud } from 'lucide-react';

const STEP_LABELS = ['Upload', 'Transcribe', 'Generate', 'Study'];

function useMedia(query: string) {
	const [matches, setMatches] = useState(false);
	useEffect(() => {
		const mql = window.matchMedia(query);
		setMatches(mql.matches);
		const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, [query]);
	return matches;
}

function StepUpload() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-6">
			<div className="relative flex h-44 w-full max-w-sm items-center justify-center rounded-2xl border-2 border-dashed border-foreground/25 bg-background/60">
				<motion.div
					initial={{ y: -90, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.8, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.6 }}
					className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)]"
				>
					<FileAudio className="h-8 w-8" />
				</motion.div>
				<UploadCloud className="absolute bottom-3 right-3 h-5 w-5 text-foreground/40" />
			</div>
			<svg viewBox="0 0 120 120" className="h-24 w-24">
				<circle cx="60" cy="60" r="52" fill="none" stroke="#1E1E24" strokeOpacity="0.12" strokeWidth="10" />
				<circle
					cx="60" cy="60" r="52" fill="none" stroke="#1E1E24" strokeWidth="10" strokeLinecap="round"
					strokeDasharray="327" transform="rotate(-90 60 60)"
				>
					<animate attributeName="stroke-dashoffset" values="327;0;0" keyTimes="0;0.7;1" dur="2.6s" repeatCount="indefinite" />
				</circle>
			</svg>
		</div>
	);
}

function StepTranscribe() {
	const lines = ['“So today we\'re covering cellular respiration…”', '“…glycolysis splits glucose into pyruvate…”', '“…the Krebs cycle produces NADH and FADH₂…”', '“…and oxidative phosphorylation yields most ATP.”'];
	return (
		<div className="flex h-full flex-col items-center justify-center gap-8">
			<div className="flex h-16 items-end gap-1.5">
				{[0.9, 0.5, 1, 0.6, 0.8, 0.4, 0.95, 0.55, 0.75, 0.45, 0.85, 0.6].map((h, i) => (
					<motion.span
						key={i}
						className="w-2 rounded-full bg-foreground"
						animate={{ height: [`${h * 20}%`, `${h * 100}%`, `${h * 20}%`] }}
						transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
					/>
				))}
			</div>
			<div className="w-full max-w-md space-y-2.5">
				{lines.map((line, i) => (
					<motion.p
						key={line}
						initial={{ opacity: 0, x: -14 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.4 + i * 0.55, duration: 0.4 }}
						className="rounded-lg border border-foreground/10 bg-card/80 px-3.5 py-2 text-sm font-medium"
					>
						{line}
					</motion.p>
				))}
			</div>
		</div>
	);
}

function StepGenerate() {
	const [morphed, setMorphed] = useState(false);
	useEffect(() => {
		const id = window.setInterval(() => setMorphed((v) => !v), 2800);
		return () => window.clearInterval(id);
	}, []);

	const cards = [
		{ id: 'a', label: 'Notes', icon: FileText },
		{ id: 'b', label: 'Flashcards', icon: Layers },
		{ id: 'c', label: 'Quiz', icon: ListChecks },
		{ id: 'd', label: 'Mind Map', icon: Network },
	];

	return (
		<div className="flex h-full items-center justify-center">
			{morphed ? (
				<div className="grid w-full max-w-md grid-cols-2 gap-3">
					{cards.map((card) => (
						<motion.div
							key={card.id}
							layoutId={card.id}
							className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/15 bg-card font-bold shadow-[0_3px_0_0_rgba(30,30,36,0.1)]"
						>
							<card.icon className="h-6 w-6" />
							{card.label}
						</motion.div>
					))}
				</div>
			) : (
				<div className="w-full max-w-md space-y-3">
					{cards.map((card) => (
						<motion.div
							key={card.id}
							layoutId={card.id}
							className="h-12 rounded-xl border border-foreground/10 bg-card/80"
						/>
					))}
				</div>
			)}
		</div>
	);
}

function StepStudy() {
	return (
		<div className="grid h-full w-full max-w-lg grid-cols-2 grid-rows-2 gap-3">
			<div className="notebook-card overflow-hidden p-3">
				<p className="text-xs font-bold">Notes</p>
				<motion.div
					animate={{ y: [0, -26, 0] }}
					transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
					className="mt-2 space-y-1.5"
				>
					{[80, 95, 60, 88, 70, 92, 55].map((w, i) => (
						<div key={i} className="h-2 rounded-full bg-foreground/15" style={{ width: `${w}%` }} />
					))}
				</motion.div>
			</div>
			<div className="notebook-card flex items-center justify-center p-3 [perspective:400px]">
				<motion.div
					animate={{ rotateY: [0, 180, 360] }}
					transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
					className="flex h-16 w-24 items-center justify-center rounded-lg bg-foreground text-[10px] font-bold text-background [transform-style:preserve-3d]"
				>
					Flashcard
				</motion.div>
			</div>
			<div className="notebook-card p-3">
				<p className="text-xs font-bold">Quiz</p>
				<div className="mt-2 space-y-1.5">
					{['A', 'B', 'C'].map((o, i) => (
						<motion.div
							key={o}
							animate={{ backgroundColor: i === 1 ? ['rgba(30,30,36,0.06)', 'rgba(30,30,36,0.9)', 'rgba(30,30,36,0.06)'] : 'rgba(30,30,36,0.06)' }}
							transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.2 }}
							className="rounded-md px-2 py-1.5 text-[10px] font-semibold"
							style={{ color: undefined }}
						>
							<motion.span animate={{ color: i === 1 ? ['#1E1E24', '#FFF4E0', '#1E1E24'] : '#1E1E24' }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.2 }}>
								Option {o}
							</motion.span>
						</motion.div>
					))}
				</div>
			</div>
			<div className="notebook-card flex items-center justify-center p-3">
				<svg viewBox="0 0 100 60" className="h-full w-full">
					<line x1="50" y1="30" x2="18" y2="12" stroke="#1E1E24" strokeOpacity="0.3" strokeWidth="1.5" />
					<line x1="50" y1="30" x2="18" y2="48" stroke="#1E1E24" strokeOpacity="0.3" strokeWidth="1.5" />
					<line x1="50" y1="30" x2="84" y2="30" stroke="#1E1E24" strokeOpacity="0.3" strokeWidth="1.5" />
					<motion.circle cx="84" cy="30" r="6" fill="#FFEAC2" stroke="#1E1E24" animate={{ r: [6, 9, 6] }} transition={{ duration: 2, repeat: Infinity }} />
					<circle cx="18" cy="12" r="6" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.4" />
					<circle cx="18" cy="48" r="6" fill="#FFEAC2" stroke="#1E1E24" strokeOpacity="0.4" />
					<circle cx="50" cy="30" r="9" fill="#1E1E24" />
				</svg>
			</div>
		</div>
	);
}

const STEPS = [StepUpload, StepTranscribe, StepGenerate, StepStudy];

const STEP_COPY = [
	{ title: 'Drop in your recording', body: 'Drag an MP3 or MP4 of any lecture into the upload zone. Up to 100 MB, straight from your phone or laptop.' },
	{ title: 'Whisper transcribes every word', body: 'Audio becomes an accurate, timestamped transcript you can search and jump through.' },
	{ title: 'AI builds your study kit', body: 'The transcript breaks apart into structured notes, a flashcard deck, a quiz and a mind map — in parallel.' },
	{ title: 'Study what actually sticks', body: 'Flip cards, take the quiz, explore the map. Unknown cards cycle back until they are known.' },
];

function StepPanel({ progress, index, children }: { progress: MotionValue<number>; index: number; children: React.ReactNode }) {
	const start = index / 4;
	const end = (index + 1) / 4;
	const fade = 0.04;
	const opacity = useTransform(
		progress,
		[Math.max(0, start - fade), start + fade, end - fade, Math.min(1, end + fade)],
		index === 0 ? [1, 1, 1, 0] : index === 3 ? [0, 1, 1, 1] : [0, 1, 1, 0],
	);
	const y = useTransform(progress, [start, end], [30, -30]);
	return (
		<motion.div style={{ opacity, y }} className="absolute inset-0 flex items-center justify-center p-6">
			{children}
		</motion.div>
	);
}

export function HowItWorks() {
	const targetRef = useRef<HTMLDivElement>(null);
	const isMobile = useMedia('(max-width: 767px)');
	const reduced = useReducedMotion();
	const { scrollYProgress } = useScroll({ target: targetRef, offset: ['start start', 'end end'] });
	const [autoStep, setAutoStep] = useState(0);

	useEffect(() => {
		if (!isMobile || reduced) return;
		const id = window.setInterval(() => setAutoStep((s) => (s + 1) % 4), 4000);
		return () => window.clearInterval(id);
	}, [isMobile, reduced]);

	const activeStep = isMobile ? autoStep : Math.min(3, Math.floor(scrollYProgress.get() * 4));

	if (reduced) {
		return (
			<section id="how-it-works" className="scroll-mt-24 py-20">
				<div className="mx-auto max-w-6xl px-4">
					<h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">How it works</h2>
					<div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{STEP_COPY.map((step, i) => (
							<div key={step.title} className="notebook-card p-6">
								<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-sm font-bold text-background">{i + 1}</span>
								<h3 className="mt-4 font-bold">{step.title}</h3>
								<p className="mt-2 text-sm text-foreground/70">{step.body}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		);
	}

	const stage = (
		<div className="relative h-[420px] overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-[#FFF9EC] to-[#FFEAC2] shadow-[0_6px_0_0_rgba(30,30,36,0.08)] md:h-[480px]">
			{isMobile ? (
				STEPS.map((Step, i) => (
					<motion.div
						key={i}
						initial={false}
						animate={{ opacity: autoStep === i ? 1 : 0 }}
						transition={{ duration: 0.5 }}
						className="absolute inset-0 flex items-center justify-center p-6"
						style={{ pointerEvents: autoStep === i ? 'auto' : 'none' }}
					>
						<Step />
					</motion.div>
				))
			) : (
				STEPS.map((Step, i) => (
					<StepPanel key={i} progress={scrollYProgress} index={i}>
						<Step />
					</StepPanel>
				))
			)}
		</div>
	);

	const inner = (
		<div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[0.9fr_1.1fr]">
			<div>
				<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">How it works</p>
				<h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
					From recording to revision in four steps
				</h2>
				<div className="mt-8 space-y-2">
					{STEP_COPY.map((step, i) => (
						<div
							key={step.title}
							className={`rounded-2xl border p-4 transition-all duration-300 ${
								activeStep === i
									? 'border-foreground/20 bg-card shadow-[0_3px_0_0_rgba(30,30,36,0.1)]'
									: 'border-transparent opacity-50'
							}`}
						>
							<div className="flex items-center gap-3">
								<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${activeStep === i ? 'bg-foreground text-background' : 'bg-secondary'}`}>
									{i + 1}
								</span>
								<h3 className="font-bold">{step.title}</h3>
							</div>
							{activeStep === i ? <p className="mt-2 pl-11 text-sm text-foreground/70">{step.body}</p> : null}
						</div>
					))}
				</div>
			</div>
			{stage}
		</div>
	);

	if (isMobile) {
		return (
			<section id="how-it-works" className="scroll-mt-24 py-20">
				{inner}
			</section>
		);
	}

	return (
		<section id="how-it-works" ref={targetRef} className="relative scroll-mt-24" style={{ height: '400vh' }}>
			<div className="sticky top-0 flex min-h-[100dvh] items-center py-16">{inner}</div>
		</section>
	);
}
