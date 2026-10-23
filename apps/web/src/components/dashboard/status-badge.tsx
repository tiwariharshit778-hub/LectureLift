import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { LectureStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const CONFIG: Record<LectureStatus, { label: string; className: string; spinning: boolean }> = {
	pending: { label: 'Pending', className: 'bg-secondary text-foreground/70', spinning: true },
	transcribing: { label: 'Transcribing', className: 'bg-secondary text-foreground', spinning: true },
	generating: { label: 'Generating', className: 'bg-secondary text-foreground', spinning: true },
	ready: { label: 'Ready', className: 'bg-foreground text-background', spinning: false },
	failed: { label: 'Failed', className: 'bg-destructive/15 text-destructive', spinning: false },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
	const config = CONFIG[status] ?? CONFIG.pending;
	const Icon = status === 'ready' ? CheckCircle2 : status === 'failed' ? AlertTriangle : Loader2;
	return (
		<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', config.className)}>
			<Icon className={cn('h-3 w-3', config.spinning && 'animate-spin')} />
			{config.label}
		</span>
	);
}
