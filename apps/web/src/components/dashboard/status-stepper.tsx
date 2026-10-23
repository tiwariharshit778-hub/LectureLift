import { Check, Loader2 } from 'lucide-react';
import type { LectureStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS: { key: LectureStatus; label: string }[] = [
	{ key: 'pending', label: 'Pending' },
	{ key: 'transcribing', label: 'Transcribing' },
	{ key: 'generating', label: 'Generating' },
	{ key: 'ready', label: 'Ready' },
];

const ORDER: Record<LectureStatus, number> = {
	pending: 0,
	transcribing: 1,
	generating: 2,
	ready: 3,
	failed: -1,
};

export function StatusStepper({ status }: { status: LectureStatus }) {
	const current = ORDER[status] ?? 0;
	return (
		<ol className="flex items-center gap-0">
			{STEPS.map((step, i) => {
				// `current` for 'ready' is 3 — the Ready step's own index, since it's
				// the last entry in STEPS — so `i === current` there means the Ready
				// step is "active" (i.e. in progress, spinning) rather than "done"
				// (checked), even though 'ready' is a terminal, completed state, not
				// an in-progress one. Once ready, every step including that one is done.
				const done = status !== 'failed' && (i < current || status === 'ready');
				const active = status !== 'failed' && status !== 'ready' && i === current;
				return (
					<li key={step.key} className="flex flex-1 items-center last:flex-none">
						<div className="flex flex-col items-center gap-1.5">
							<span
								className={cn(
									'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
									done && 'border-foreground bg-foreground text-background',
									active && 'border-foreground bg-secondary text-foreground',
									!done && !active && 'border-foreground/20 text-foreground/40',
								)}
							>
								{done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
							</span>
							<span className={cn('text-[11px] font-bold', active || done ? 'text-foreground' : 'text-foreground/40')}>
								{step.label}
							</span>
						</div>
						{i < STEPS.length - 1 ? (
							<div className={cn('mx-2 mb-5 h-0.5 flex-1 rounded-full', i < current ? 'bg-foreground' : 'bg-foreground/15')} />
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
