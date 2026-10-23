import { useState } from 'react';
import { ArrowRight, CheckCircle2, ListChecks, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import type { QuizQuestionRecord } from '@/lib/types';
import { EmptyState } from '@/components/dashboard/skeletons';
import { cn } from '@/lib/utils';

export function QuizTab({ questions, lectureId }: { questions: QuizQuestionRecord[]; lectureId: string }) {
	const { user } = useAuth();
	const [current, setCurrent] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);
	const [correctCount, setCorrectCount] = useState(0);
	const [finished, setFinished] = useState(false);
	const [saving, setSaving] = useState(false);

	if (questions.length === 0) {
		return (
			<EmptyState
				icon={ListChecks}
				title="No quiz available"
				body="A quiz could not be generated for this lecture. Try reprocessing it."
			/>
		);
	}

	const question = questions[current];
	// The options + correct answer live together in `options` (a JSON field) —
	// the record's own `correct_index` field is a write-only placeholder, see
	// QuizOptions in types.ts for why.
	const options = question.options?.list ?? [];
	const correctIndex = question.options?.correctIndex;

	const select = (i: number) => {
		if (selected !== null) return;
		setSelected(i);
		if (i === correctIndex) setCorrectCount((c) => c + 1);
	};

	const next = async () => {
		if (current + 1 < questions.length) {
			setCurrent((c) => c + 1);
			setSelected(null);
			return;
		}
		// Last question answered — save the attempt.
		setSaving(true);
		try {
			await pb.collection('quiz_attempts').create({
				lecture: lectureId,
				user: user?.id,
				score: correctCount,
				total: questions.length,
			});
		} catch {
			toast.error('Could not save your quiz result.');
		} finally {
			setSaving(false);
			setFinished(true);
		}
	};

	const restart = () => {
		setCurrent(0);
		setSelected(null);
		setCorrectCount(0);
		setFinished(false);
	};

	if (finished) {
		const percent = Math.round((correctCount / questions.length) * 100);
		return (
			<div className="notebook-card flex flex-col items-center px-6 py-14 text-center">
				<span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background">
					<Trophy className="h-8 w-8" />
				</span>
				<h3 className="mt-5 text-2xl font-extrabold">
					{correctCount} / {questions.length} correct
				</h3>
				<p className="mt-2 text-sm text-muted-foreground">
					{percent >= 80
						? 'Excellent — this lecture is basically yours.'
						: percent >= 50
							? 'Solid. Review the flashcards and try again.'
							: 'Worth another pass — the notes tab is a good place to start.'}
				</p>
				<div className="mt-4 h-2.5 w-56 overflow-hidden rounded-full bg-secondary">
					<div className="h-full rounded-full bg-foreground" style={{ width: `${percent}%` }} />
				</div>
				<button
					onClick={restart}
					className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-6 text-sm font-bold text-background transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					<RotateCcw className="h-4 w-4" /> Retake quiz
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold">
					Question {current + 1} of {questions.length}
				</p>
				<p className="text-sm font-bold text-muted-foreground">{correctCount} correct</p>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-secondary">
				<div
					className="h-full rounded-full bg-foreground transition-all duration-300"
					style={{ width: `${(current / questions.length) * 100}%` }}
				/>
			</div>

			<div className="notebook-card p-6 sm:p-8">
				<h3 className="text-lg font-extrabold leading-snug">{question.question}</h3>
				<div className="mt-6 space-y-2.5">
					{options.map((option, i) => {
						const isCorrect = i === correctIndex;
						const isSelected = i === selected;
						return (
							<button
								key={i}
								onClick={() => select(i)}
								disabled={selected !== null}
								className={cn(
									'flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-all',
									selected === null && 'border-foreground/15 hover:border-foreground/40 hover:bg-secondary/60',
									selected !== null && isCorrect && 'border-foreground bg-foreground text-background',
									selected !== null && isSelected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
									selected !== null && !isSelected && !isCorrect && 'border-foreground/10 opacity-50',
								)}
							>
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current text-xs font-extrabold">
									{String.fromCharCode(65 + i)}
								</span>
								<span className="flex-1">{option}</span>
								{selected !== null && isCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
								{selected !== null && isSelected && !isCorrect ? <XCircle className="h-5 w-5 shrink-0" /> : null}
							</button>
						);
					})}
				</div>

				{selected !== null ? (
					<div className="mt-5 rounded-xl bg-secondary/60 p-4">
						<p className="text-xs font-bold uppercase tracking-widest text-foreground/50">Explanation</p>
						<p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{question.explanation}</p>
					</div>
				) : null}
			</div>

			{selected !== null ? (
				<button
					onClick={next}
					disabled={saving}
					className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-bold text-background shadow-[0_3px_0_0_rgba(30,30,36,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
				>
					{current + 1 < questions.length ? (
						<>Next question <ArrowRight className="h-4 w-4" /></>
					) : (
						'See my results'
					)}
				</button>
			) : null}
		</div>
	);
}
