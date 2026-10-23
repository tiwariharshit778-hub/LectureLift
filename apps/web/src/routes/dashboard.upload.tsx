import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, FileAudio, FileVideo, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import pb, { POCKETBASE_API_URL } from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type { LectureRecord } from '@/lib/types';
import { StatusStepper } from '@/components/dashboard/status-stepper';
import { inputClass } from '@/components/auth/auth-layout';
import { cn } from '@/lib/utils';

const MAX_SIZE = 100 * 1024 * 1024;
const ACCEPTED = ['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'];

function isAccepted(file: File) {
	return ACCEPTED.includes(file.type) || /\.(mp3|mp4)$/i.test(file.name);
}

export default function Upload() {
	const { user } = useAuth();
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [title, setTitle] = useState('');
	const [subject, setSubject] = useState('');
	const [description, setDescription] = useState('');
	const [phase, setPhase] = useState<'form' | 'uploading' | 'processing'>('form');
	const [progress, setProgress] = useState(0);
	const [lecture, setLecture] = useState<LectureRecord | null>(null);
	// Owns the realtime subscription's lifecycle across the async upload flow —
	// a plain useEffect keyed on phase/lecture id would only subscribe *after*
	// phase flips to 'processing', racing the server's first status write (see
	// the explicit subscribe-before-triggering in onSubmit below).
	const unsubscribeRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			unsubscribeRef.current?.();
		};
	}, []);

	const pickFile = (candidate: File | null | undefined) => {
		if (!candidate) return;
		if (!isAccepted(candidate)) {
			toast.error('Only MP3 and MP4 files are supported.');
			return;
		}
		if (candidate.size > MAX_SIZE) {
			toast.error('Files must be 100 MB or smaller.');
			return;
		}
		setFile(candidate);
		if (!title) setTitle(candidate.name.replace(/\.(mp3|mp4)$/i, ''));
	};

	const startProcessing = async (lectureId: string) => {
		const response = await fetch('/api/process-lecture', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${pb.authStore.token}`,
			},
			body: JSON.stringify({ lecture_id: lectureId }),
		});
		if (!response.ok && response.status !== 202) {
			throw new Error(`Processing request failed (${response.status})`);
		}
	};

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !file) return;
		setPhase('uploading');
		setProgress(0);

		try {
			const record = await new Promise<LectureRecord>((resolve, reject) => {
				const form = new FormData();
				form.append('user', user.id);
				form.append('title', title.trim());
				form.append('subject', subject.trim());
				form.append('description', description.trim());
				form.append('file_type', file.type.startsWith('video') || /\.mp4$/i.test(file.name) ? 'video' : 'audio');
				form.append('status', 'pending');
				form.append('file', file);

				const xhr = new XMLHttpRequest();
				xhr.open('POST', `${POCKETBASE_API_URL}/api/collections/lectures/records`);
				xhr.setRequestHeader('Authorization', pb.authStore.token);
				xhr.upload.onprogress = (event) => {
					if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
				};
				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve(JSON.parse(xhr.responseText) as LectureRecord);
					} else {
						reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
					}
				};
				xhr.onerror = () => reject(new Error('Network error during upload'));
				xhr.send(form);
			});

			// Subscribe *before* triggering processing, and await it, so the
			// WebSocket is guaranteed live before the server can write its first
			// status update. Firing them in the other order races the subscription's
			// handshake against the server's write — lose that race and the UI
			// misses every update up to the final ready/failed one, so the stepper
			// looks stuck on "Pending" for the whole run.
			unsubscribeRef.current = await pb.collection('lectures').subscribe<LectureRecord>(record.id, (e) => {
				setLecture(e.record);
			});

			setLecture(record);
			setPhase('processing');
			// Transcription always runs server-side (Groq, falling back to the
			// configured Whisper provider) — no on-device transcription step here.
			// It was previously tried first in-browser, but a first-time model
			// download there (100-200MB+) is typically slower than just letting
			// Groq handle it, and it added a whole extra UI phase for no net gain.
			await startProcessing(record.id);
		} catch (err) {
			toast.error(err instanceof Error ? 'Upload failed. Please try again.' : 'Upload failed.');
			setPhase('form');
		}
	};

	const retry = async () => {
		if (!lecture) return;
		try {
			setLecture({ ...lecture, status: 'pending', error_message: '' });
			await startProcessing(lecture.id);
		} catch {
			toast.error('Could not restart processing. Please try again.');
		}
	};

	const reset = () => {
		setFile(null);
		setTitle('');
		setSubject('');
		setDescription('');
		setLecture(null);
		setProgress(0);
		setPhase('form');
	};

	if (phase === 'processing' && lecture) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Processing your lecture</h1>
				<div className="notebook-card p-8">
					<p className="truncate text-lg font-bold">{lecture.title}</p>
					<p className="mt-1 text-sm text-muted-foreground">
						You can leave this page — we will keep working. Watch live:
					</p>
					<div className="mt-8">
						<StatusStepper status={lecture.status} />
					</div>

					{lecture.status === 'failed' ? (
						<div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
							<p className="flex items-center gap-2 text-sm font-bold text-destructive">
								<AlertTriangle className="h-4 w-4" /> Processing failed
							</p>
							<p className="mt-1.5 text-sm text-foreground/70">
								{lecture.error_message || 'Something went wrong while processing this lecture.'}
							</p>
							<button
								onClick={retry}
								className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background"
							>
								<RotateCcw className="h-4 w-4" /> Retry
							</button>
						</div>
					) : null}

					{lecture.status === 'ready' ? (
						<div className="mt-8 rounded-xl border border-foreground/15 bg-secondary/60 p-5">
							<p className="text-sm font-bold">Your study kit is ready.</p>
							{lecture.error_message ? (
								<p className="mt-1 text-xs text-foreground/60">Note: {lecture.error_message}</p>
							) : null}
							<Link
								to={`/dashboard/lectures/${lecture.id}`}
								className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background"
							>
								Open lecture <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					) : null}
				</div>
				<button onClick={reset} className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
					Upload another lecture
				</button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Upload a lecture</h1>
				<p className="mt-1 text-sm text-muted-foreground">MP3 or MP4. For the MVP demo, please upload a recording around 10-12 MB.</p>
			</div>

			<form onSubmit={onSubmit} className="notebook-card space-y-5 p-6 sm:p-8">
				<div
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragOver(false);
						pickFile(e.dataTransfer.files?.[0]);
					}}
					onClick={() => inputRef.current?.click()}
					className={cn(
						'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
						dragOver ? 'border-foreground bg-secondary/70' : 'border-foreground/25 bg-background/50 hover:border-foreground/50',
					)}
				>
					<input
						ref={inputRef}
						type="file"
						accept=".mp3,.mp4,audio/mpeg,video/mp4"
						className="hidden"
						onChange={(e) => pickFile(e.target.files?.[0])}
					/>
					{file ? (
						<>
							<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
								{file.type.startsWith('video') || /\.mp4$/i.test(file.name) ? (
									<FileVideo className="h-7 w-7" />
								) : (
									<FileAudio className="h-7 w-7" />
								)}
							</span>
							<p className="mt-4 max-w-full truncate text-sm font-bold">{file.name}</p>
							<p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setFile(null);
								}}
								className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-bold hover:bg-secondary"
							>
								<X className="h-3.5 w-3.5" /> Remove
							</button>
						</>
					) : (
						<>
							<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
								<UploadCloud className="h-7 w-7" />
							</span>
							<p className="mt-4 text-sm font-bold">Drag and drop your recording here</p>
							<p className="mt-1 text-xs text-muted-foreground">or click to browse — MP3 / MP4, max 100 MB</p>
						</>
					)}
				</div>

				{phase === 'uploading' ? (
					<div className="space-y-3">
						<div>
							<div className="flex items-center justify-between text-xs font-bold">
								<span className="inline-flex items-center gap-2">
									<Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
								</span>
								<span>{progress}%</span>
							</div>
							<div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
								<div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
							</div>
						</div>
					</div>
				) : null}

				<div className="space-y-2">
					<label htmlFor="title" className="text-sm font-semibold">Title</label>
					<input
						id="title" required maxLength={200}
						value={title} onChange={(e) => setTitle(e.target.value)}
						placeholder="BIO-201 — Cell Respiration" className={inputClass}
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="subject" className="text-sm font-semibold">Subject</label>
					<input
						id="subject" maxLength={120}
						value={subject} onChange={(e) => setSubject(e.target.value)}
						placeholder="Biology" className={inputClass}
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="description" className="text-sm font-semibold">
						Description <span className="font-normal text-muted-foreground">(optional)</span>
					</label>
					<textarea
						id="description" rows={3} maxLength={2000}
						value={description} onChange={(e) => setDescription(e.target.value)}
						placeholder="Week 7 lecture covering glycolysis and the Krebs cycle…"
						className={cn(inputClass, 'h-auto py-3')}
					/>
				</div>

				<button
					type="submit"
					disabled={!file || !title.trim() || phase === 'uploading'}
					className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
				>
					{phase === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
					{phase === 'uploading' ? 'Uploading…' : 'Upload & Process'}
				</button>
			</form>
		</div>
	);
}
