import { useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import type { TranscriptRecord } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/skeletons';
import { inputClass } from '@/components/auth/auth-layout';
import { cn } from '@/lib/utils';

function formatTime(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function Highlighted({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const lower = text.toLowerCase();
	const q = query.toLowerCase();
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	let key = 0;
	while (true) {
		const hit = lower.indexOf(q, cursor);
		if (hit === -1) {
			parts.push(text.slice(cursor));
			break;
		}
		parts.push(text.slice(cursor, hit));
		parts.push(
			<mark key={key++} className="rounded bg-[#FFD98F] px-0.5 font-semibold">
				{text.slice(hit, hit + q.length)}
			</mark>,
		);
		cursor = hit + q.length;
	}
	return <>{parts}</>;
}

export function TranscriptTab({ transcript }: { transcript: TranscriptRecord | null }) {
	const [query, setQuery] = useState('');

	const segments = useMemo(
		() => (Array.isArray(transcript?.segments?.segments) ? transcript.segments.segments : []),
		[transcript],
	);

	// The full transcript lives in segments.fullText — content is only ever a
	// 5000-character preview (a fixed PocketBase field limit, see
	// TRANSCRIPT_CONTENT_PREVIEW_MAX in pipeline.server.ts). Falling back to
	// content keeps this working for any record written before that change.
	const fullText = transcript?.segments?.fullText || transcript?.content || '';

	if (!transcript) {
		return (
			<EmptyState
				icon={FileText}
				title="No transcript available"
				body="The transcript for this lecture could not be generated. Try reprocessing the lecture."
			/>
		);
	}

	const matches = query
		? (fullText.toLowerCase().split(query.toLowerCase()).length - 1)
		: 0;

	return (
		<div className="space-y-4">
			<div className="relative">
				<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search the transcript…"
					className={cn(inputClass, 'pl-10')}
				/>
				{query ? (
					<span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
						{matches} match{matches === 1 ? '' : 'es'}
					</span>
				) : null}
			</div>

			<div className="notebook-card max-h-[60vh] overflow-y-auto p-6">
				{segments.length > 0 ? (
					<div className="space-y-3">
						{segments.map((segment, i) => (
							<div key={i} className="flex gap-4">
								<span className="mt-0.5 w-12 shrink-0 font-mono text-xs font-bold text-muted-foreground">
									{formatTime(segment.start)}
								</span>
								<p className="text-sm leading-relaxed text-foreground/85">
									<Highlighted text={segment.text} query={query} />
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
						<Highlighted text={fullText} query={query} />
					</p>
				)}
			</div>
		</div>
	);
}
