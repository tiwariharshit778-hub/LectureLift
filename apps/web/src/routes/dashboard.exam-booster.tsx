import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
	ArrowDown,
	BookOpen,
	BookOpenCheck,
	CalendarDays,
	Check,
	CircleHelp,
	Clock3,
	FileText,
	KeyRound,
	Loader2,
	Search,
	Sparkles,
	UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExamBooster } from '@/components/lecture/exam-booster';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { inputClass } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import pb from '@/lib/pocketbase-client';
import type { LectureRecord } from '@/lib/types';
import { cn } from '@/lib/utils';

const FEATURES = [
	{
		title: 'Smart Revision Sheet',
		description: 'Bring the lecture’s most important ideas together for a clear, focused review.',
		icon: FileText,
		previewTitle: 'A focused recap',
		preview: 'An illustrative outline of core ideas, organized to make a quick review easier.',
	},
	{
		title: 'Key Terms Explained',
		description: 'Review essential vocabulary with clear, student-friendly explanations.',
		icon: KeyRound,
		previewTitle: 'Understand the language',
		preview: 'An illustrative term-and-definition layout for learning unfamiliar concepts.',
	},
	{
		title: '10 Practice Questions',
		description: 'Check your understanding with questions, answers, and helpful explanations.',
		icon: CircleHelp,
		previewTitle: 'Practice with purpose',
		preview: 'An illustrative question card with space to consider an answer and explanation.',
	},
	{
		title: 'Focused 3-Day Revision Plan',
		description: 'Turn what you learned into a manageable plan for the days ahead.',
		icon: CalendarDays,
		previewTitle: 'A plan you can follow',
		preview: 'An illustrative three-day schedule balancing review, practice, and reflection.',
	},
] as const;

type LectureFilter = 'all' | 'ready';

const formatDuration = (durationSeconds: number): string => {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'Duration unavailable';

	const totalMinutes = Math.round(durationSeconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) return `${totalMinutes} min`;
	return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
};

export default function ExamBoosterPage() {
	const { user } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const [lectures, setLectures] = useState<LectureRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState<LectureFilter>('all');
	const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;

		void (async () => {
			try {
				const list = await pb.collection('lectures').getFullList<LectureRecord>({ sort: '-created' });
				if (!cancelled) setLectures(list);
			} catch {
				if (!cancelled) toast.error('Could not load your lectures.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [user]);

	const selectedLectureId = searchParams.get('lecture');
	const selectedLecture = lectures.find((lecture) => lecture.id === selectedLectureId && lecture.status === 'ready');
	const filteredLectures = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		return lectures.filter((lecture) =>
			(filter === 'all' || lecture.status === 'ready')
			&& (!normalizedSearch || lecture.title.toLowerCase().includes(normalizedSearch)),
		);
	}, [filter, lectures, search]);

	const scrollToLibrary = () => {
		document.getElementById('exam-booster-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const selectLecture = (lectureId: string) => {
		const nextParams = new URLSearchParams(searchParams);
		nextParams.set('lecture', lectureId);
		setSearchParams(nextParams, { preventScrollReset: true });
	};

	const clearSelection = () => {
		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete('lecture');
		setSearchParams(nextParams, { preventScrollReset: true });
		scrollToLibrary();
	};

	return (
		<div className="space-y-12 pb-8">
			<section className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-card/70 px-6 py-10 shadow-[0_8px_30px_rgba(30,30,36,0.06)] sm:px-10 sm:py-14">
				<div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
				<div className="relative max-w-3xl">
					<p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/80 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-foreground/75">
						<Sparkles className="h-4 w-4 text-primary" />
						Introducing AI Exam Booster
					</p>
					<h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
						Want to stay one step ahead of everyone in your classroom?
					</h1>
					<p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
						Turn your classroom lectures into personalized exam preparation kits, powered by AI.
					</p>
					<Button
						type="button"
						onClick={scrollToLibrary}
						className="mt-7 h-12 rounded-xl bg-foreground px-5 font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.2)] transition-transform hover:-translate-y-0.5 hover:bg-foreground/90"
					>
						Explore your lecture library
						<ArrowDown className="ml-1 h-4 w-4" />
					</Button>
				</div>
			</section>

			<section aria-labelledby="booster-features-heading">
				<div className="mb-5">
					<p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Made for your next exam</p>
					<h2 id="booster-features-heading" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
						Study with more direction
					</h2>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					{FEATURES.map((feature) => {
						const Icon = feature.icon;
						const isExpanded = expandedFeature === feature.title;
						const previewId = `feature-preview-${feature.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
						return (
							<button
								key={feature.title}
								type="button"
								aria-expanded={isExpanded}
								aria-controls={previewId}
								onClick={() => setExpandedFeature(isExpanded ? null : feature.title)}
								className="group rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
							>
								<article className="h-full rounded-2xl border border-foreground/10 bg-card/70 p-5 shadow-[0_3px_12px_rgba(30,30,36,0.04)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/25 group-hover:shadow-[0_8px_22px_rgba(30,30,36,0.09)] sm:p-6">
									<div className="flex items-start gap-4">
										<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
											<Icon className="h-5 w-5" />
										</span>
										<div>
											<h3 className="font-extrabold">{feature.title}</h3>
											<p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.description}</p>
										</div>
									</div>
									<div
										id={previewId}
										hidden={!isExpanded}
										className="mt-4 rounded-xl border border-primary/15 bg-background/80 p-4"
									>
										<p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-primary">
											<Check className="h-3.5 w-3.5" /> {feature.previewTitle}
										</p>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.preview}</p>
										<p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
											Illustrative preview · not paid lecture content
										</p>
									</div>
									<p className="mt-4 text-xs font-bold text-foreground/55">
										{isExpanded ? 'Tap to close preview' : 'Tap to preview'}
									</p>
								</article>
							</button>
						);
					})}
				</div>
			</section>

			<section id="exam-booster-library" className="scroll-mt-8 space-y-5" aria-labelledby="library-heading">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Your learning, organized</p>
						<h2 id="library-heading" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
							Your Exam Booster Library
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Choose a ready lecture to view or create its Exam Booster.
						</p>
					</div>
					<p className="text-sm font-semibold text-muted-foreground">
						{lectures.length} lecture{lectures.length === 1 ? '' : 's'}
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative flex-1">
						<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							aria-label="Search lectures by title"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search lecture titles…"
							className={cn(inputClass, 'pl-10')}
						/>
					</div>
					<div className="flex rounded-xl border border-foreground/10 bg-card/60 p-1" role="group" aria-label="Filter lectures">
						{(['all', 'ready'] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={filter === value}
								onClick={() => setFilter(value)}
								className={cn(
									'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
									filter === value ? 'bg-foreground text-background' : 'text-foreground/65 hover:bg-secondary',
								)}
							>
								{value === 'all' ? 'All' : 'Ready'}
							</button>
						))}
					</div>
				</div>

				{selectedLecture ? (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-card/60 px-4 py-3">
							<div className="min-w-0">
								<p className="truncate font-bold">{selectedLecture.title}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{selectedLecture.subject || 'No subject'} · {formatDuration(selectedLecture.duration_seconds)}
								</p>
							</div>
							<Button type="button" variant="outline" size="sm" onClick={clearSelection} className="rounded-xl">
								<BookOpen className="h-4 w-4" />
								Back to library
							</Button>
						</div>
						<ExamBooster key={selectedLecture.id} lectureId={selectedLecture.id} lectureTitle={selectedLecture.title} />
					</div>
				) : null}

				{loading ? (
					<div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 bg-card/50 py-12 text-sm font-semibold text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading your lectures…
					</div>
				) : lectures.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-foreground/20 bg-card/40 px-6 py-12 text-center">
						<BookOpenCheck className="mx-auto h-8 w-8 text-primary/70" />
						<h3 className="mt-3 font-extrabold">Your library is ready for its first lecture</h3>
						<p className="mt-1 text-sm text-muted-foreground">Upload a lecture to start building an Exam Booster.</p>
						<Link
							to="/dashboard/upload"
							className="mt-5 inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-bold text-background"
						>
							Upload a lecture
						</Link>
					</div>
				) : filteredLectures.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-foreground/20 bg-card/40 px-6 py-10 text-center">
						<Search className="mx-auto h-6 w-6 text-muted-foreground" />
						<p className="mt-3 font-bold">No lectures match those filters</p>
						<p className="mt-1 text-sm text-muted-foreground">Try another title or switch to All lectures.</p>
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{filteredLectures.map((lecture) => {
							const isReady = lecture.status === 'ready';
							const isSelected = selectedLecture?.id === lecture.id;
							return (
								<button
									key={lecture.id}
									type="button"
									disabled={!isReady}
									onClick={() => selectLecture(lecture.id)}
									aria-pressed={isSelected}
									className={cn(
										'group flex w-full items-start gap-4 rounded-2xl border bg-card/65 p-4 text-left shadow-[0_2px_8px_rgba(30,30,36,0.03)] transition-all duration-200',
										isReady
											? 'cursor-pointer border-foreground/10 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_6px_18px_rgba(30,30,36,0.08)]'
											: 'cursor-not-allowed border-foreground/5 opacity-75',
										isSelected && 'border-primary/40 bg-primary/5 ring-1 ring-primary/15',
									)}
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
										<BookOpen className="h-5 w-5" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-start justify-between gap-2">
											<span className="line-clamp-2 font-bold leading-snug">{lecture.title}</span>
											<StatusBadge status={lecture.status} />
										</span>
										<span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
											<span>{lecture.subject || 'No subject'}</span>
											<span className="inline-flex items-center gap-1">
												<Clock3 className="h-3.5 w-3.5" />
												{formatDuration(lecture.duration_seconds)}
											</span>
										</span>
										<span className="mt-3 block text-xs font-bold text-primary">
											{isSelected ? 'Selected' : isReady ? 'Select lecture' : 'Available when ready'}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-card/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div className="flex min-w-0 items-start gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
						<UsersRound className="h-4 w-4" />
					</span>
					<div className="min-w-0">
						<h2 className="font-bold">Live Mentorship</h2>
						<p className="mt-0.5 text-sm text-muted-foreground">
							Guidance from experienced mentors, coming soon.
						</p>
					</div>
				</div>
				<span className="inline-flex w-fit shrink-0 items-center rounded-full border border-foreground/10 bg-background/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
					Coming soon
				</span>
			</section>
		</div>
	);
}
