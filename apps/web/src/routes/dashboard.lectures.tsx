import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, FileAudio, FileVideo, Search, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type { LectureRecord, LectureStatus } from '@/lib/types';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState, LectureCardSkeleton } from '@/components/dashboard/skeletons';
import { inputClass } from '@/components/auth/auth-layout';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: LectureStatus | 'all'; label: string }[] = [
	{ value: 'all', label: 'All statuses' },
	{ value: 'ready', label: 'Ready' },
	{ value: 'pending', label: 'Pending' },
	{ value: 'transcribing', label: 'Transcribing' },
	{ value: 'generating', label: 'Generating' },
	{ value: 'failed', label: 'Failed' },
];

export default function Lectures() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [lectures, setLectures] = useState<LectureRecord[]>([]);
	const [search, setSearch] = useState('');
	const [subject, setSubject] = useState('all');
	const [status, setStatus] = useState<LectureStatus | 'all'>('all');
	const [lectureToDelete, setLectureToDelete] = useState<LectureRecord | null>(null);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		(async () => {
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

	const deleteLecture = async () => {
		if (!lectureToDelete) return;

		setDeleting(true);
		try {
			await pb.collection('lectures').delete(lectureToDelete.id);
			setLectures((current) => current.filter((lecture) => lecture.id !== lectureToDelete.id));
			setLectureToDelete(null);
			toast.success('Lecture deleted.');
		} catch {
			toast.error('Could not delete this lecture. Please try again.');
		} finally {
			setDeleting(false);
		}
	};

	const subjects = useMemo(
		() => Array.from(new Set(lectures.map((l) => l.subject).filter(Boolean))).sort(),
		[lectures],
	);

	const filtered = useMemo(
		() =>
			lectures.filter((lecture) => {
				if (subject !== 'all' && lecture.subject !== subject) return false;
				if (status !== 'all' && lecture.status !== status) return false;
				if (search && !lecture.title.toLowerCase().includes(search.toLowerCase())) return false;
				return true;
			}),
		[lectures, subject, status, search],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My Lectures</h1>
					<p className="mt-1 text-sm text-muted-foreground">{lectures.length} lecture{lectures.length === 1 ? '' : 's'} in your library</p>
				</div>
				<Link
					to="/dashboard/upload"
					className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<UploadCloud className="h-4 w-4" /> Upload
				</Link>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by title…"
						className={cn(inputClass, 'pl-10')}
					/>
				</div>
				<select value={subject} onChange={(e) => setSubject(e.target.value)} className={cn(inputClass, 'sm:w-44')}>
					<option value="all">All subjects</option>
					{subjects.map((s) => (
						<option key={s} value={s}>{s}</option>
					))}
				</select>
				<select value={status} onChange={(e) => setStatus(e.target.value as LectureStatus | 'all')} className={cn(inputClass, 'sm:w-44')}>
					{STATUS_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>{option.label}</option>
					))}
				</select>
			</div>

			{loading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => <LectureCardSkeleton key={i} />)}
				</div>
			) : filtered.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					title={lectures.length === 0 ? 'No lectures yet' : 'Nothing matches'}
					body={lectures.length === 0 ? 'Upload your first recording to build your study library.' : 'Try a different search or filter.'}
					action={
						lectures.length === 0 ? (
							<Link to="/dashboard/upload" className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background">
								<UploadCloud className="h-4 w-4" /> Upload a lecture
							</Link>
						) : undefined
					}
				/>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((lecture) => (
						<article
							key={lecture.id}
							className="notebook-card group flex flex-col p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_6px_0_0_rgba(30,30,36,0.12)]"
						>
							<div className="flex items-start justify-between gap-3">
								<Link
									to={`/dashboard/lectures/${lecture.id}`}
									aria-label={`Open ${lecture.title}`}
									className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background"
								>
									{lecture.file_type === 'video' ? <FileVideo className="h-5 w-5" /> : <FileAudio className="h-5 w-5" />}
								</Link>
								<div className="flex items-center gap-2">
									<StatusBadge status={lecture.status} />
									<Button
										variant="ghost"
										size="icon"
										title={`Delete ${lecture.title}`}
										aria-label={`Delete ${lecture.title}`}
										disabled={deleting}
										onClick={() => setLectureToDelete(lecture)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<Link to={`/dashboard/lectures/${lecture.id}`} className="mt-4 block">
								<p className="line-clamp-2 font-bold leading-snug">{lecture.title}</p>
								<p className="mt-2 text-xs text-muted-foreground">
									{lecture.subject || 'No subject'} · {new Date(lecture.created).toLocaleDateString()}
								</p>
							</Link>
						</article>
					))}
				</div>
			)}

			<AlertDialog
				open={Boolean(lectureToDelete)}
				onOpenChange={(open) => {
					if (!open && !deleting) setLectureToDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete lecture?</AlertDialogTitle>
						<AlertDialogDescription>
							Delete "{lectureToDelete?.title}" from your library? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(event) => {
								event.preventDefault();
								void deleteLecture();
							}}
						>
							{deleting ? 'Deleting...' : 'Delete lecture'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
