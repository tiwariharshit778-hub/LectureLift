import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import type { FlashcardRecord } from '@/lib/types';
import { cn } from '@/lib/utils';

export async function saveReview(card: FlashcardRecord, state: 'known' | 'unknown') {
	const now = new Date();
	const next = new Date(now);
	next.setDate(next.getDate() + (state === 'known' ? 3 : 1));
	await pb.collection('flashcards').update(card.id, {
		review_state: state,
		last_reviewed_at: now.toISOString(),
		next_review_at: next.toISOString(),
	});
}

export function StudyMode({
	cards,
	onExit,
	onReviewed,
}: {
	cards: FlashcardRecord[];
	onExit: () => void;
	onReviewed?: (card: FlashcardRecord, state: 'known' | 'unknown') => void;
}) {
	const [queue, setQueue] = useState<FlashcardRecord[]>(cards);
	const [index, setIndex] = useState(0);
	const [flipped, setFlipped] = useState(false);
	const [done, setDone] = useState(false);
	const [knownCount, setKnownCount] = useState(0);

	const current = queue[index];

	const mark = async (state: 'known' | 'unknown') => {
		if (!current) return;
		try {
			await saveReview(current, state);
			onReviewed?.(current, state);
		} catch {
			toast.error('Could not save your review. It will still count for this session.');
		}
		if (state === 'known') setKnownCount((c) => c + 1);
		const nextQueue = state === 'unknown' ? [...queue, current] : queue;
		setQueue(nextQueue);
		setFlipped(false);
		if (index + 1 >= nextQueue.length) {
			setDone(true);
		} else {
			setIndex((i) => i + 1);
		}
	};

	if (done || !current) {
		return (
			<div className="notebook-card flex flex-col items-center px-6 py-14 text-center">
				<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
					<Check className="h-7 w-7" strokeWidth={3} />
				</span>
				<h3 className="mt-4 text-xl font-extrabold">Session complete</h3>
				<p className="mt-1.5 text-sm text-muted-foreground">
					You marked {knownCount} of {cards.length} cards as known. Unknown cards will come back sooner.
				</p>
				<button
					onClick={onExit}
					className="mt-6 inline-flex h-11 items-center rounded-xl bg-foreground px-6 text-sm font-bold text-background"
				>
					Back to cards
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold">
					Card {index + 1} of {queue.length}
				</p>
				<button
					onClick={onExit}
					className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-bold hover:bg-secondary"
				>
					<X className="h-3.5 w-3.5" /> End session
				</button>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-secondary">
				<div
					className="h-full rounded-full bg-foreground transition-all duration-300"
					style={{ width: `${(index / queue.length) * 100}%` }}
				/>
			</div>

			<button
				onClick={() => setFlipped((f) => !f)}
				className="block w-full [perspective:1000px]"
				aria-label="Flip card"
			>
				<div
					className={cn(
						'relative h-64 w-full transition-transform duration-500 [transform-style:preserve-3d] sm:h-72',
						flipped && '[transform:rotateY(180deg)]',
					)}
				>
					<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-foreground/15 bg-card p-8 shadow-[0_4px_0_0_rgba(30,30,36,0.1)] [backface-visibility:hidden]">
						<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Question</p>
						<p className="mt-3 max-w-lg text-balance text-lg font-bold leading-snug">{current.question}</p>
						<p className="mt-6 text-xs text-muted-foreground">Tap to reveal the answer</p>
					</div>
					<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-foreground p-8 text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
						<p className="text-xs font-bold uppercase tracking-widest text-background/60">Answer</p>
						<p className="mt-3 max-w-lg text-balance text-lg font-bold leading-snug">{current.answer}</p>
					</div>
				</div>
			</button>

			<div className="grid grid-cols-2 gap-3">
				<button
					onClick={() => mark('unknown')}
					disabled={!flipped}
					className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-foreground/20 text-sm font-bold transition-colors hover:bg-secondary disabled:opacity-40"
				>
					<RotateCcw className="h-4 w-4" /> Still learning
				</button>
				<button
					onClick={() => mark('known')}
					disabled={!flipped}
					className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0"
				>
					<Check className="h-4 w-4" strokeWidth={3} /> I knew this
				</button>
			</div>
			{!flipped ? <p className="text-center text-xs text-muted-foreground">Flip the card before grading yourself.</p> : null}
		</div>
	);
}
