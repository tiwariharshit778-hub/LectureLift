import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type { FlashcardRecord } from '@/lib/types';
import { StudyMode } from '@/components/flashcards/study-mode';
import { EmptyState, LectureCardSkeleton } from '@/components/dashboard/skeletons';

export default function Study() {
	const { user } = useAuth();
	const [cards, setCards] = useState<FlashcardRecord[] | null>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		(async () => {
			try {
				const now = new Date().toISOString().replace('T', ' ');
				const due = await pb.collection('flashcards').getFullList<FlashcardRecord>({
					filter: `(next_review_at = "" || next_review_at <= "${now}")`,
					sort: 'next_review_at,created',
				});
				if (!cancelled) setCards(due);
			} catch {
				if (!cancelled) toast.error('Could not load your review queue.');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [user]);

	const onReviewed = (card: FlashcardRecord, state: 'known' | 'unknown') => {
		setCards((prev) => prev?.map((c) => (c.id === card.id ? { ...c, review_state: state } : c)) ?? prev);
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Study session</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Every flashcard due for review, across all your lectures.
				</p>
			</div>

			{cards === null ? (
				<div className="space-y-3">
					<LectureCardSkeleton />
					<LectureCardSkeleton />
				</div>
			) : cards.length === 0 ? (
				<EmptyState
					icon={Zap}
					title="All caught up"
					body="No flashcards are due for review right now. Upload a new lecture or come back tomorrow."
					action={
						<Link to="/dashboard/upload" className="inline-flex h-11 items-center rounded-xl bg-foreground px-5 text-sm font-bold text-background">
							Upload a lecture
						</Link>
					}
				/>
			) : (
				<StudyMode key={cards.length} cards={cards} onExit={() => window.location.reload()} onReviewed={onReviewed} />
			)}
		</div>
	);
}
