import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, Flame, Layers, ListChecks, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { ClientResponseError } from 'pocketbase';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type { LectureRecord } from '@/lib/types';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { CardSkeleton, EmptyState, LectureCardSkeleton } from '@/components/dashboard/skeletons';

interface Stats {
	processed: number;
	flashcards: number;
	quizzes: number;
	streak: number;
}

function dayKey(iso: string) {
	return iso.slice(0, 10);
}

function computeStreak(days: Set<string>) {
	let streak = 0;
	const cursor = new Date();
	// Allow the streak to start today or yesterday.
	if (!days.has(dayKey(cursor.toISOString()))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!days.has(dayKey(cursor.toISOString()))) return 0;
	}
	while (days.has(dayKey(cursor.toISOString()))) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

export default function Overview() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [recent, setRecent] = useState<LectureRecord[]>([]);
	const [stats, setStats] = useState<Stats>({ processed: 0, flashcards: 0, quizzes: 0, streak: 0 });

	useEffect(() => {
		if (!user) return;
		let cancelled = false;

		(async () => {
			try {
				// requestKey: null on every call — the PocketBase SDK auto-cancels an
				// in-flight request when another request to the same collection+action
				// starts before it finishes, and this fires two `lectures` calls and
				// two `flashcards` calls concurrently via Promise.all. Without this,
				// they raced and cancelled each other, surfacing as an "aborted
				// (autocancelled)" error on whichever call lost, which the bare
				// `catch {}` this used to have then discarded entirely.
				const [lectureList, readyList, flashcardList, attempts, reviewed] = await Promise.all([
					pb.collection('lectures').getList<LectureRecord>(1, 5, { sort: '-created', requestKey: null }),
					pb.collection('lectures').getList(1, 1, { filter: 'status = "ready"', fields: 'id', requestKey: null }),
					pb.collection('flashcards').getList(1, 1, { fields: 'id', requestKey: null }),
					pb.collection('quiz_attempts').getFullList({ fields: 'created', requestKey: null }),
					pb.collection('flashcards').getFullList({ filter: 'last_reviewed_at != ""', fields: 'last_reviewed_at', requestKey: null }),
				]);
				if (cancelled) return;

				const days = new Set<string>();
				attempts.forEach((a) => days.add(dayKey(a.created)));
				reviewed.forEach((f) => days.add(dayKey(f.last_reviewed_at)));

				setRecent(lectureList.items);
				setStats({
					processed: readyList.totalItems,
					flashcards: flashcardList.totalItems,
					quizzes: attempts.length,
					streak: computeStreak(days),
				});
			} catch (error) {
				// The bare `catch { ... }` this replaced discarded the actual error
				// entirely — no console log, no detail in the toast — so a real
				// failure here was undiagnosable from the browser alone. Surface it
				// the same way pipeline.server.ts's describeError() does server-side:
				// ClientResponseError's own `.message` is a generic wrapper text, the
				// useful part is `.response`.
				const detail =
					error instanceof ClientResponseError
						? `${error.message} (${error.status}) ${JSON.stringify(error.response)}`
						: error instanceof Error
							? error.message
							: String(error);
				console.error('Overview failed to load:', error);
				if (!cancelled) toast.error(`Could not load your overview. Please refresh. (details: ${detail.slice(0, 200)})`);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [user]);

	const cards = [
		{ icon: BookOpen, label: 'Lectures processed', value: stats.processed },
		{ icon: Layers, label: 'Flashcards generated', value: stats.flashcards },
		{ icon: ListChecks, label: 'Quizzes taken', value: stats.quizzes },
		{ icon: Flame, label: 'Day study streak', value: stats.streak },
	];

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
						Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">Here is your study snapshot.</p>
				</div>
				<Link
					to="/dashboard/upload"
					className="inline-flex h-12 items-center gap-2 rounded-xl bg-foreground px-6 text-sm font-bold text-background shadow-[0_4px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<UploadCloud className="h-4 w-4" />
					Upload New Lecture
				</Link>
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{loading
					? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
					: cards.map((card) => (
							<div key={card.label} className="notebook-card p-5 transition-transform duration-200 hover:-translate-y-0.5">
								<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
									<card.icon className="h-5 w-5" />
								</span>
								<p className="mt-4 text-3xl font-extrabold tracking-tight">{card.value.toLocaleString()}</p>
								<p className="mt-1 text-xs font-semibold text-muted-foreground">{card.label}</p>
							</div>
						))}
			</div>

			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-extrabold">Recent lectures</h2>
					<Link to="/dashboard/lectures" className="inline-flex items-center gap-1 text-sm font-bold hover:underline">
						View all <ArrowRight className="h-4 w-4" />
					</Link>
				</div>

				{loading ? (
					<div className="space-y-3">
						{Array.from({ length: 3 }).map((_, i) => <LectureCardSkeleton key={i} />)}
					</div>
				) : recent.length === 0 ? (
					<EmptyState
						icon={BookOpen}
						title="No lectures yet"
						body="Upload your first recording and LectureLift will turn it into notes, flashcards, a quiz and a mind map."
						action={
							<Link to="/dashboard/upload" className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background">
								<UploadCloud className="h-4 w-4" /> Upload a lecture
							</Link>
						}
					/>
				) : (
					<div className="space-y-3">
						{recent.map((lecture) => (
							<Link
								key={lecture.id}
								to={`/dashboard/lectures/${lecture.id}`}
								className="notebook-card flex items-center justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_rgba(30,30,36,0.1)]"
							>
								<div className="min-w-0">
									<p className="truncate font-bold">{lecture.title}</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{lecture.subject || 'No subject'} · {new Date(lecture.created).toLocaleDateString()}
									</p>
								</div>
								<StatusBadge status={lecture.status} />
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
