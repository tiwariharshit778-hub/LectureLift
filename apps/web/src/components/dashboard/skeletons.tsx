export function CardSkeleton({ className = '' }: { className?: string }) {
	return (
		<div className={`notebook-card animate-pulse p-6 ${className}`}>
			<div className="h-4 w-1/3 rounded-full bg-foreground/10" />
			<div className="mt-4 h-8 w-1/2 rounded-full bg-foreground/10" />
			<div className="mt-4 h-3 w-2/3 rounded-full bg-foreground/10" />
		</div>
	);
}

export function LectureCardSkeleton() {
	return (
		<div className="notebook-card animate-pulse p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="h-5 w-2/3 rounded-full bg-foreground/10" />
				<div className="h-5 w-16 rounded-full bg-foreground/10" />
			</div>
			<div className="mt-3 h-3 w-1/3 rounded-full bg-foreground/10" />
			<div className="mt-4 h-3 w-1/2 rounded-full bg-foreground/10" />
		</div>
	);
}

export function EmptyState({
	icon: Icon,
	title,
	body,
	action,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	body: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="notebook-card flex flex-col items-center px-6 py-14 text-center">
			<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
				<Icon className="h-7 w-7" />
			</span>
			<h3 className="mt-4 text-lg font-bold">{title}</h3>
			<p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
			{action ? <div className="mt-6">{action}</div> : null}
		</div>
	);
}
