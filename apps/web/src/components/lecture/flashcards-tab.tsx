import { useState } from 'react';
import { ArrowLeft, ArrowRight, Layers, Play } from 'lucide-react';
import type { FlashcardRecord } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/skeletons';
import { StudyMode } from '@/components/flashcards/study-mode';
import { cn } from '@/lib/utils';

export function FlashcardsTab({ flashcards }: { flashcards: FlashcardRecord[] }) {
	const [index, setIndex] = useState(0);
	const [flipped, setFlipped] = useState(false);
	const [studying, setStudying] = useState(false);

	if (flashcards.length === 0) {
		return (
			<EmptyState
				icon={Layers}
				title="No flashcards available"
				body="Flashcards could not be generated for this lecture. Try reprocessing it."
			/>
		);
	}

	if (studying) {
		return <StudyMode cards={flashcards} onExit={() => setStudying(false)} />;
	}

	const card = flashcards[index];

	const go = (delta: number) => {
		setFlipped(false);
		setIndex((i) => (i + delta + flashcards.length) % flashcards.length);
	};

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold">
					Card {index + 1} of {flashcards.length}
				</p>
				<button
					onClick={() => setStudying(true)}
					className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<Play className="h-4 w-4" /> Study Mode
				</button>
			</div>

			<button onClick={() => setFlipped((f) => !f)} className="block w-full [perspective:1000px]" aria-label="Flip card">
				<div
					className={cn(
						'relative h-64 w-full transition-transform duration-500 [transform-style:preserve-3d] sm:h-72',
						flipped && '[transform:rotateY(180deg)]',
					)}
				>
					<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-foreground/15 bg-card p-8 shadow-[0_4px_0_0_rgba(30,30,36,0.1)] [backface-visibility:hidden]">
						<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Question</p>
						<p className="mt-3 max-w-lg text-balance text-lg font-bold leading-snug">{card.question}</p>
						<p className="mt-6 text-xs text-muted-foreground">Tap to flip</p>
					</div>
					<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-foreground p-8 text-background [backface-visibility:hidden] [transform:rotateY(180deg)]">
						<p className="text-xs font-bold uppercase tracking-widest text-background/60">Answer</p>
						<p className="mt-3 max-w-lg text-balance text-lg font-bold leading-snug">{card.answer}</p>
					</div>
				</div>
			</button>

			<div className="flex items-center justify-center gap-3">
				<button
					onClick={() => go(-1)}
					aria-label="Previous card"
					className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground/15 transition-colors hover:bg-secondary"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<span
					className={cn(
						'rounded-full px-3 py-1.5 text-xs font-bold',
						card.review_state === 'known' && 'bg-foreground text-background',
						card.review_state === 'unknown' && 'bg-[#FFD98F]',
						(!card.review_state || card.review_state === 'new') && 'bg-secondary text-foreground/60',
					)}
				>
					{card.review_state === 'known' ? 'Known' : card.review_state === 'unknown' ? 'Learning' : 'New'}
				</span>
				<button
					onClick={() => go(1)}
					aria-label="Next card"
					className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-foreground/15 transition-colors hover:bg-secondary"
				>
					<ArrowRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
