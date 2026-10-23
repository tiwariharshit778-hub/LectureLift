import { Download, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { NoteRecord, NotesContent } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/skeletons';

function toMarkdown(notes: NotesContent) {
	let md = `# ${notes.title}\n\n${notes.summary}\n`;
	for (const section of notes.sections ?? []) {
		md += `\n## ${section.heading}\n\n`;
		for (const bullet of section.bullets ?? []) md += `- ${bullet}\n`;
		if (section.key_terms?.length) md += `\n**Key terms:** ${section.key_terms.join(', ')}\n`;
	}
	return md;
}

export function NotesTab({ note }: { note: NoteRecord | null }) {
	if (!note?.content) {
		return (
			<EmptyState
				icon={FileText}
				title="No notes available"
				body="Revision notes could not be generated for this lecture. Try reprocessing it."
			/>
		);
	}

	const content = note.content;

	const exportMarkdown = () => {
		const blob = new Blob([toMarkdown(content)], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${content.title || 'lecture-notes'}.md`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Notes exported as Markdown.');
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap gap-2 print:hidden">
				<button
					onClick={exportMarkdown}
					className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<Download className="h-4 w-4" /> Export as Markdown
				</button>
				<button
					onClick={() => window.print()}
					className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-foreground/15 px-4 text-sm font-bold transition-colors hover:bg-secondary"
				>
					<Printer className="h-4 w-4" /> Print / Save as PDF
				</button>
			</div>

			<article className="notebook-card p-6 sm:p-8">
				<h2 className="text-2xl font-extrabold tracking-tight">{content.title}</h2>
				<p className="mt-3 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed text-foreground/80">
					{content.summary}
				</p>

				<div className="mt-8 space-y-8">
					{(content.sections ?? []).map((section, i) => (
						<section key={i}>
							<h3 className="flex items-center gap-3 text-lg font-extrabold">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
									{i + 1}
								</span>
								{section.heading}
							</h3>
							<ul className="mt-3 space-y-2 pl-10">
								{(section.bullets ?? []).map((bullet, j) => (
									<li key={j} className="list-disc text-sm leading-relaxed text-foreground/85 marker:text-foreground/40">
										{bullet}
									</li>
								))}
							</ul>
							{section.key_terms?.length ? (
								<div className="mt-3 flex flex-wrap gap-1.5 pl-10">
									{section.key_terms.map((term) => (
										<span key={term} className="rounded-full bg-[#FFD98F]/70 px-2.5 py-1 text-xs font-bold">
											{term}
										</span>
									))}
								</div>
							) : null}
						</section>
					))}
				</div>
			</article>
		</div>
	);
}
