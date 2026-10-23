import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, FileText, Layers, ListChecks, Network, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type {
	FlashcardRecord,
	LectureRecord,
	MindMapRecord,
	MindMapNode,
	NoteRecord,
	QuizQuestionRecord,
	TranscriptRecord,
} from '@/lib/types';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { StatusStepper } from '@/components/dashboard/status-stepper';
import { CardSkeleton } from '@/components/dashboard/skeletons';
import { TranscriptTab } from '@/components/lecture/transcript-tab';
import { NotesTab } from '@/components/lecture/notes-tab';
import { FlashcardsTab } from '@/components/lecture/flashcards-tab';
import { QuizTab } from '@/components/lecture/quiz-tab';
import { MindMapTab } from '@/components/lecture/mind-map-tab';
import { cn } from '@/lib/utils';

const TABS = [
	{ key: 'transcript', label: 'Transcript', icon: FileText },
	{ key: 'notes', label: 'Notes', icon: FileText },
	{ key: 'flashcards', label: 'Flashcards', icon: Layers },
	{ key: 'quiz', label: 'Quiz', icon: ListChecks },
	{ key: 'mindmap', label: 'Mind Map', icon: Network },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function getMindMapTopics(node: MindMapNode): string[] {
	return [node.topic, ...(node.children ?? []).flatMap(getMindMapTopics)];
}

async function firstOrNull<T>(collection: string, filter: string): Promise<T | null> {
	try {
		return await pb.collection(collection).getFirstListItem<T>(filter);
	} catch {
		return null;
	}
}

export default function LectureDetail() {
	const { id } = useParams();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [missing, setMissing] = useState(false);
	const [lecture, setLecture] = useState<LectureRecord | null>(null);
	const [transcript, setTranscript] = useState<TranscriptRecord | null>(null);
	const [note, setNote] = useState<NoteRecord | null>(null);
	const [flashcards, setFlashcards] = useState<FlashcardRecord[]>([]);
	const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
	const [mindMap, setMindMap] = useState<MindMapRecord | null>(null);
	const [tab, setTab] = useState<TabKey>('transcript');
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [copied, setCopied] = useState(false);
	const copyFeedbackTimeout = useRef<number | null>(null);

	useEffect(() => {
		if (!user || !id) return;
		let cancelled = false;

		(async () => {
			try {
				const record = await pb.collection('lectures').getOne<LectureRecord>(id);
				if (cancelled) return;
				setLecture(record);

				const [t, n, f, q, m] = await Promise.all([
					firstOrNull<TranscriptRecord>('transcripts', `lecture="${id}"`),
					firstOrNull<NoteRecord>('notes', `lecture="${id}"`),
					pb.collection('flashcards').getFullList<FlashcardRecord>({ filter: `lecture="${id}"`, sort: 'created' }),
					pb.collection('quiz_questions').getFullList<QuizQuestionRecord>({ filter: `lecture="${id}"`, sort: 'created' }),
					firstOrNull<MindMapRecord>('mind_maps', `lecture="${id}"`),
				]);
				if (cancelled) return;
				setTranscript(t);
				setNote(n);
				setFlashcards(f);
				setQuestions(q);
				setMindMap(m);
			} catch {
				if (!cancelled) setMissing(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [id, user]);

	useEffect(() => () => {
		window.speechSynthesis.cancel();
		if (copyFeedbackTimeout.current !== null) window.clearTimeout(copyFeedbackTimeout.current);
	}, []);

	// Live updates while the pipeline is working.
	useEffect(() => {
		if (!lecture || lecture.status === 'ready' || lecture.status === 'failed') return;
		const promise = pb.collection('lectures').subscribe<LectureRecord>(lecture.id, (e) => setLecture(e.record));
		return () => {
			promise.then(() => pb.collection('lectures').unsubscribe(lecture.id)).catch(() => {});
		};
	}, [lecture?.id, lecture?.status]);

	const retry = async () => {
		if (!lecture) return;
		try {
			setLecture({ ...lecture, status: 'pending', error_message: '' });
			const response = await fetch('/api/process-lecture', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
				body: JSON.stringify({ lecture_id: lecture.id }),
			});
			if (!response.ok) throw new Error();
		} catch {
			toast.error('Could not restart processing.');
		}
	};

	if (loading) {
		return (
			<div className="space-y-4">
				<div className="h-6 w-40 animate-pulse rounded-full bg-foreground/10" />
				<CardSkeleton />
				<CardSkeleton />
			</div>
		);
	}

	if (missing || !lecture) {
		return (
			<div className="notebook-card flex flex-col items-center px-6 py-16 text-center">
				<h1 className="text-xl font-extrabold">Lecture not found</h1>
				<p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
				<Link to="/dashboard/lectures" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background">
					<ArrowLeft className="h-4 w-4" /> Back to My Lectures
				</Link>
			</div>
		);
	}

	const processing = lecture.status !== 'ready' && lecture.status !== 'failed';
	const activeText = (() => {
		switch (tab) {
			case 'transcript':
				return transcript?.segments?.fullText
					|| transcript?.segments?.segments?.map((segment) => segment.text).join('\n')
					|| transcript?.content
					|| '';
			case 'notes':
				if (!note?.content) return '';
				return [
					note.content.title,
					note.content.summary,
					...(note.content.sections ?? []).flatMap((section) => [
						section.heading,
						...(section.bullets ?? []),
						...(section.key_terms?.length ? [`Key terms: ${section.key_terms.join(', ')}`] : []),
					]),
				].filter(Boolean).join('\n\n');
			case 'flashcards':
				return flashcards.flatMap((card) => [`Question: ${card.question}`, `Answer: ${card.answer}`]).join('\n\n');
			case 'quiz':
				return questions.map((question, index) => [
					`Question ${index + 1}: ${question.question}`,
					...(question.options?.list ?? []).map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`),
				].join('\n')).join('\n\n');
			case 'mindmap':
				return mindMap ? getMindMapTopics(mindMap.structure).join('\n') : '';
		}
	})();

	const selectTab = (nextTab: TabKey) => {
		if (isSpeaking) {
			window.speechSynthesis.cancel();
			setIsSpeaking(false);
		}
		setCopied(false);
		setTab(nextTab);
	};

	const toggleReadAloud = () => {
		if (isSpeaking) {
			window.speechSynthesis.cancel();
			setIsSpeaking(false);
			return;
		}

		if (!activeText.trim()) return;
		if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
			toast.error('Read Aloud is not supported in this browser.');
			return;
		}

		const utterance = new SpeechSynthesisUtterance(activeText);
		utterance.onend = () => setIsSpeaking(false);
		utterance.onerror = () => setIsSpeaking(false);
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
		setIsSpeaking(true);
	};

	const copyActiveText = async () => {
		try {
			await navigator.clipboard.writeText(activeText);
			setCopied(true);
			if (copyFeedbackTimeout.current !== null) window.clearTimeout(copyFeedbackTimeout.current);
			copyFeedbackTimeout.current = window.setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error('Could not copy this content.');
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<Link to="/dashboard/lectures" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
					<ArrowLeft className="h-4 w-4" /> My Lectures
				</Link>
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{lecture.title}</h1>
					<StatusBadge status={lecture.status} />
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{lecture.subject || 'No subject'} · {new Date(lecture.created).toLocaleDateString()}
					{lecture.duration_seconds ? ` · ${Math.round(lecture.duration_seconds / 60)} min` : ''}
				</p>
				{lecture.status === 'ready' ? (
					<div className="mt-3 flex flex-wrap gap-2 print:hidden">
						<button
							type="button"
							onClick={toggleReadAloud}
							disabled={!activeText.trim()}
							aria-pressed={isSpeaking}
							className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-foreground/15 px-3 text-sm font-bold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSpeaking ? '⏹ Stop Reading' : '🔊 Read Aloud'}
						</button>
						<button
							type="button"
							onClick={() => void copyActiveText()}
							disabled={!activeText.trim()}
							className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-foreground/15 px-3 text-sm font-bold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
						>
							{copied ? 'Copied!' : '📋 Copy'}
						</button>
						<button
							type="button"
							onClick={() => window.print()}
							className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-foreground/15 px-3 text-sm font-bold transition-colors hover:bg-secondary"
						>
							📥 Export PDF
						</button>
					</div>
				) : null}
				{lecture.description ? <p className="mt-2 max-w-2xl text-sm text-foreground/70">{lecture.description}</p> : null}
			</div>

			{processing ? (
				<div className="notebook-card p-8">
					<p className="text-sm font-bold">Processing in progress — this page updates live.</p>
					<div className="mt-6">
						<StatusStepper status={lecture.status} />
					</div>
				</div>
			) : null}

			{lecture.status === 'failed' ? (
				<div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
					<p className="flex items-center gap-2 text-sm font-bold text-destructive">
						<AlertTriangle className="h-4 w-4" /> Processing failed
					</p>
					<p className="mt-1.5 text-sm text-foreground/70">{lecture.error_message || 'Something went wrong.'}</p>
					<button onClick={retry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background">
						<RotateCcw className="h-4 w-4" /> Retry processing
					</button>
				</div>
			) : null}

			{lecture.status === 'ready' && lecture.error_message ? (
				<p className="rounded-xl border border-foreground/15 bg-secondary/60 px-4 py-3 text-xs font-semibold text-foreground/70">
					Partial result: {lecture.error_message}
				</p>
			) : null}

			{lecture.status === 'ready' ? (
				<>
					<div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-foreground/10 bg-card/60 p-1.5">
						{TABS.map((t) => (
							<button
								key={t.key}
								onClick={() => selectTab(t.key)}
								className={cn(
									'flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors',
									tab === t.key ? 'bg-foreground text-background' : 'text-foreground/60 hover:bg-secondary hover:text-foreground',
								)}
							>
								<t.icon className="h-4 w-4" />
								{t.label}
							</button>
						))}
					</div>

					<div key={tab} className="animate-[fadein_0.25s_ease-out]">
						<style>{`@keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
						{tab === 'transcript' ? <TranscriptTab transcript={transcript} /> : null}
						{tab === 'notes' ? <NotesTab note={note} /> : null}
						{tab === 'flashcards' ? <FlashcardsTab flashcards={flashcards} /> : null}
						{tab === 'quiz' ? <QuizTab questions={questions} lectureId={lecture.id} /> : null}
						{tab === 'mindmap' ? <MindMapTab mindMap={mindMap} /> : null}
					</div>
				</>
			) : null}
		</div>
	);
}
