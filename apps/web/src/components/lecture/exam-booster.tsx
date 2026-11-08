import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertTriangle, BookOpenCheck, CalendarDays, Check, CheckCircle2, CircleHelp, CreditCard, FileText, KeyRound, Loader2, LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pb from '@/lib/pocketbase-client';

type RevisionSheet = {
	title: string;
	quickReview: string;
	keyPoints: string[];
	keyTerms: { term: string; definition: string }[];
};

type ExamBoosterOutput = {
	revisionSheet: RevisionSheet;
	practiceQuestions: { question: string; answer: string; explanation: string }[];
	threeDayPlan: { day: number; focus: string; tasks: string[] }[];
};

type ApiError = Error & { status: number };
type BoosterState = 'checking' | 'available' | 'creating-order' | 'redirecting' | 'capturing' | 'generating' | 'pending' | 'cancelled' | 'error' | 'ready';

const isObject = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isExamBoosterOutput = (value: unknown): value is ExamBoosterOutput => {
	if (!isObject(value) || !isObject(value.revisionSheet)) return false;
	const sheet = value.revisionSheet;
	return typeof sheet.title === 'string'
		&& typeof sheet.quickReview === 'string'
		&& Array.isArray(sheet.keyPoints)
		&& sheet.keyPoints.every((item) => typeof item === 'string')
		&& Array.isArray(sheet.keyTerms)
		&& sheet.keyTerms.every((item) => isObject(item) && typeof item.term === 'string' && typeof item.definition === 'string')
		&& Array.isArray(value.practiceQuestions)
		&& value.practiceQuestions.length === 10
		&& value.practiceQuestions.every((item) =>
			isObject(item) && typeof item.question === 'string' && typeof item.answer === 'string' && typeof item.explanation === 'string')
		&& Array.isArray(value.threeDayPlan)
		&& value.threeDayPlan.length === 3
		&& value.threeDayPlan.every((item) =>
			isObject(item) && typeof item.day === 'number' && typeof item.focus === 'string' && Array.isArray(item.tasks)
			&& item.tasks.every((task) => typeof task === 'string'));
};

const requestJson = async <T,>(path: string, body: Record<string, string>, token: string): Promise<T> => {
	const response = await fetch(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(body),
	});

	let responseBody: unknown;
	try {
		responseBody = await response.json();
	} catch {
		throw Object.assign(new Error('The server returned an unreadable response. Please retry.'), { status: response.status });
	}

	if (!response.ok) {
		const message = isObject(responseBody)
			? (typeof responseBody.error === 'string' ? responseBody.error : typeof responseBody.message === 'string' ? responseBody.message : '')
			: '';
		throw Object.assign(new Error(message || 'The request could not be completed. Please retry.'), { status: response.status });
	}

	return responseBody as T;
};

const getApiMessage = (error: unknown) =>
	error instanceof Error ? error.message : 'Something went wrong. Please retry.';

export function ExamBooster({ lectureId, lectureTitle }: { lectureId: string; lectureTitle: string }) {
	const location = useLocation();
	const navigate = useNavigate();
	const [state, setState] = useState<BoosterState>('checking');
	const [output, setOutput] = useState<ExamBoosterOutput | null>(null);
	const [message, setMessage] = useState('');
	const [pendingOrderId, setPendingOrderId] = useState('');
	const [hasPurchase, setHasPurchase] = useState(false);
	const activeRequest = useRef(false);
	const handledReturn = useRef('');
	const isCurrent = useRef(true);
	const checkoutAttempt = useRef(0);
	const checkoutRedirectPendingRef = useRef(false);

	useEffect(() => {
		isCurrent.current = true;
		return () => {
			isCurrent.current = false;
		};
	}, []);

	useEffect(() => {
		const restoreCheckoutState = () => {
			if (!checkoutRedirectPendingRef.current) return;

			checkoutRedirectPendingRef.current = false;
			checkoutAttempt.current += 1;
			activeRequest.current = false;
			if (!hasPurchase) setState('available');
		};

		window.addEventListener('pageshow', restoreCheckoutState);
		const restoreWhenVisible = () => {
			if (document.visibilityState === 'visible') restoreCheckoutState();
		};
		document.addEventListener('visibilitychange', restoreWhenVisible);
		return () => {
			window.removeEventListener('pageshow', restoreCheckoutState);
			document.removeEventListener('visibilitychange', restoreWhenVisible);
		};
	}, [hasPurchase]);

	const removeCheckoutQuery = useCallback(() => {
		const url = new URL(window.location.href);
		url.searchParams.delete('paypal');
		url.searchParams.delete('token');
		url.searchParams.delete('PayerID');
		handledReturn.current = `${lectureId}:${url.search}`;
		navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
	}, [lectureId, navigate]);

	const loadBooster = useCallback(async (token: string, cancelled = false, paid = false) => {
		setState(paid || hasPurchase ? 'generating' : 'checking');
		try {
			const result = await requestJson<{ output: unknown }>(
				'/api/paypal/exam-booster',
				{ lecture_id: lectureId },
				token,
			);
			if (!isCurrent.current) return;
			if (!isExamBoosterOutput(result.output)) {
				throw new Error('The Exam Booster response was incomplete. Please retry.');
			}
			setOutput(result.output);
			setHasPurchase(true);
			setState('ready');
			setMessage('');
		} catch (error) {
			if (!isCurrent.current) return;
			const status = (error as ApiError).status;
			if (status === 402) {
				setHasPurchase(false);
				setState(cancelled ? 'cancelled' : 'available');
				setMessage(cancelled ? 'Checkout was cancelled. No payment was captured.' : '');
				return;
			}
			if (status === 409) {
				setHasPurchase(true);
				setState('pending');
				setMessage('Your purchase is confirmed. The Exam Booster is still being prepared.');
				return;
			}
			setState('error');
			setMessage(getApiMessage(error));
		}
	}, [hasPurchase, lectureId]);

	const captureAndLoad = useCallback(async (orderId: string, token: string) => {
		setState('capturing');
		setMessage('Verifying your PayPal payment…');
		try {
			const capture = await requestJson<{ status: string }>(
				'/api/paypal/capture-order',
				{ order_id: orderId },
				token,
			);
			if (!isCurrent.current) return;
			if (capture.status !== 'COMPLETED') {
				throw new Error('PayPal has not confirmed a completed payment. You can retry verification.');
			}

			setHasPurchase(true);
			setPendingOrderId('');
			removeCheckoutQuery();
			await loadBooster(token, false, true);
		} catch (error) {
			if (!isCurrent.current) return;
			setPendingOrderId(orderId);
			setState('error');
			setMessage(`Payment verification did not finish. You can safely retry verification without paying again. ${getApiMessage(error)}`);
		}
	}, [lectureId, loadBooster, removeCheckoutQuery]);

	useEffect(() => {
		if (!lectureId || !pb.authStore.token || activeRequest.current) return;
		const params = new URLSearchParams(location.search);
		const paypalResult = params.get('paypal');
		const orderId = params.get('token') || '';
		const returnKey = `${lectureId}:${location.search}`;
		if (handledReturn.current === returnKey) return;
		handledReturn.current = returnKey;
		activeRequest.current = true;

		void (async () => {
			try {
				const token = pb.authStore.token;
				if (paypalResult === 'return') {
					if (!orderId) {
						setState('error');
						setMessage('PayPal returned without an order ID. Retry checkout or contact support if you were charged.');
						return;
					}
					await captureAndLoad(orderId, token);
					return;
				}
				if (paypalResult === 'cancel') {
					removeCheckoutQuery();
					await loadBooster(token, true);
					return;
				}
				setState('checking');
				await loadBooster(token);
			} finally {
				activeRequest.current = false;
			}
		})();
	}, [captureAndLoad, lectureId, loadBooster, location.search, removeCheckoutQuery]);

	const createOrder = async () => {
		if (activeRequest.current || !pb.authStore.token) return;
		const attempt = ++checkoutAttempt.current;
		activeRequest.current = true;
		setState('creating-order');
		setMessage('');
		try {
			const result = await requestJson<{ approvalUrl: string }>(
				'/api/paypal/create-order',
				{ lecture_id: lectureId },
				pb.authStore.token,
			);
			if (!isCurrent.current || checkoutAttempt.current !== attempt) return;
			const approvalUrl = new URL(result.approvalUrl);
			if (approvalUrl.protocol !== 'https:' || approvalUrl.hostname !== 'www.sandbox.paypal.com') {
				throw new Error('PayPal returned an unexpected approval link. Please retry.');
			}
			setState('redirecting');
			checkoutRedirectPendingRef.current = true;
			window.location.assign(approvalUrl.toString());
		} catch (error) {
			if (!isCurrent.current || checkoutAttempt.current !== attempt) return;
			checkoutRedirectPendingRef.current = false;
			setState('error');
			setMessage(getApiMessage(error));
			activeRequest.current = false;
		}
	};

	const retry = async () => {
		if (activeRequest.current || !pb.authStore.token) return;
		activeRequest.current = true;
		try {
			if (pendingOrderId) {
				await captureAndLoad(pendingOrderId, pb.authStore.token);
				return;
			}
			setState(hasPurchase ? 'generating' : 'checking');
			await loadBooster(pb.authStore.token);
		} finally {
			activeRequest.current = false;
		}
	};

	const busy = ['checking', 'creating-order', 'redirecting', 'capturing', 'generating'].includes(state);
	const outputId = `exam-booster-output-${lectureId}`;

	return (
		<section aria-labelledby="exam-booster-title" className="notebook-card overflow-hidden border-l-4 border-l-foreground">
			<div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-6">
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
						<Sparkles className="h-5 w-5" />
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<h2 id="exam-booster-title" className="text-base font-extrabold tracking-tight sm:text-lg">
								AI Exam Booster
							</h2>
							{state === 'ready' ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:text-green-400">
									<CheckCircle2 className="h-3.5 w-3.5" /> Purchased
								</span>
							) : null}
						</div>
						<p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
							Personalized exam preparation built from this lecture, with focused review and practice for what was actually taught.
						</p>
						<div className="mt-4 rounded-xl border border-foreground/10 bg-secondary/35 px-3.5 py-3">
							<p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">For this lecture</p>
							<p className="mt-1 break-words font-bold leading-snug">{lectureTitle}</p>
						</div>
						<ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Included in the Exam Booster">
							<li className="flex min-w-0 items-center gap-2 text-sm font-semibold">
								<FileText className="h-4 w-4 shrink-0 text-primary" /> Smart Revision Sheet
							</li>
							<li className="flex min-w-0 items-center gap-2 text-sm font-semibold">
								<KeyRound className="h-4 w-4 shrink-0 text-primary" /> Key Terms Explained
							</li>
							<li className="flex min-w-0 items-center gap-2 text-sm font-semibold">
								<CircleHelp className="h-4 w-4 shrink-0 text-primary" /> 10 Practice Questions
							</li>
							<li className="flex min-w-0 items-center gap-2 text-sm font-semibold">
								<CalendarDays className="h-4 w-4 shrink-0 text-primary" /> Focused 3-Day Revision Plan
							</li>
						</ul>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-3 lg:pt-1">
					<div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background/65 px-3.5 py-3">
						<div className="leading-tight">
							<p className="text-[11px] font-bold text-muted-foreground">One-time purchase</p>
							<p className="mt-1 text-xl font-extrabold">US$1.00</p>
						</div>
						<div className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#EAF2FC] px-3 py-2" aria-label="PayPal checkout">
							<CreditCard className="h-4 w-4 text-[#003087]" aria-hidden="true" />
							<span className="text-base font-extrabold text-[#003087]">PayPal</span>
						</div>
					</div>

					{state !== 'ready' ? (
						<>
							{state === 'pending' || state === 'error' ? (
								<Button type="button" size="sm" onClick={retry} disabled={busy} className="min-h-11 w-full rounded-xl bg-foreground px-4 font-bold text-background hover:bg-foreground/90">
									{busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
									{pendingOrderId ? 'Retry payment verification' : hasPurchase ? 'Retry Exam Booster' : 'Check purchase status'}
								</Button>
							) : (
								<Button type="button" size="sm" onClick={createOrder} disabled={busy || state === 'checking' || state === 'cancelled' && !message} className="min-h-11 w-full rounded-xl bg-foreground px-4 font-bold text-background hover:bg-foreground/90">
									{busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
									{state === 'checking' ? 'Checking purchase…'
										: state === 'creating-order' ? 'Preparing checkout…'
											: state === 'redirecting' ? 'Opening PayPal…'
												: state === 'capturing' ? 'Verifying payment…'
													: state === 'generating' ? 'Generating pack…'
															: state === 'cancelled' ? 'Try PayPal checkout again' : 'Continue with PayPal'}
								</Button>
							)}
							<p className="text-center text-[11px] leading-4 text-muted-foreground">
								PayPal Sandbox checkout · Test transaction only · No real money charged
							</p>
						</>
					) : (
						<a
							href={`#${outputId}`}
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
						>
							<BookOpenCheck className="h-4 w-4" /> View Your Exam Booster
						</a>
					)}
				</div>
			</div>

			{state !== 'ready' && message ? (
				<div className={`mx-4 mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm sm:mx-5 ${state === 'error' ? 'border border-destructive/20 bg-destructive/5 text-destructive' : 'border border-foreground/10 bg-secondary/40 text-muted-foreground'}`}>
					{state === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
					<p role={state === 'error' ? 'alert' : 'status'}>{message}</p>
				</div>
			) : null}

			{output ? (
				<div id={outputId} className="space-y-5 border-t border-foreground/10 bg-secondary/20 p-4 sm:p-6">
					<article className="rounded-2xl border border-foreground/10 bg-background p-5">
						<h3 className="flex items-center gap-2 text-base font-extrabold">
							<BookOpenCheck className="h-4 w-4 text-primary" /> {output.revisionSheet.title}
						</h3>
						<p className="mt-3 text-sm leading-7 text-foreground/80">{output.revisionSheet.quickReview}</p>
						<h4 className="mt-5 text-sm font-bold">Quick review points</h4>
						<ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground/80">
							{output.revisionSheet.keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}
						</ul>
						<h4 className="mt-5 text-sm font-bold">Key terms</h4>
						<dl className="mt-2 grid gap-3 sm:grid-cols-2">
							{output.revisionSheet.keyTerms.map(({ term, definition }) => (
								<div key={term} className="rounded-xl bg-secondary/50 p-3">
									<dt className="text-sm font-bold">{term}</dt>
									<dd className="mt-1 text-sm text-muted-foreground">{definition}</dd>
								</div>
							))}
						</dl>
					</article>

					<section>
						<h3 className="text-base font-extrabold">10 practice questions</h3>
						<div className="mt-3 space-y-2">
							{output.practiceQuestions.map(({ question, answer, explanation }, index) => (
								<details key={`${index}-${question}`} className="rounded-xl border border-foreground/10 bg-background p-4">
									<summary className="cursor-pointer text-sm font-bold">{index + 1}. {question}</summary>
									<div className="mt-3 space-y-2 border-t border-foreground/10 pt-3 text-sm">
										<p><span className="font-bold">Answer: </span>{answer}</p>
										<p className="text-muted-foreground"><span className="font-bold text-foreground">Why: </span>{explanation}</p>
									</div>
								</details>
							))}
						</div>
					</section>

					<section>
						<h3 className="text-base font-extrabold">Your three-day revision plan</h3>
						<div className="mt-3 grid gap-3 md:grid-cols-3">
							{output.threeDayPlan.map(({ day, focus, tasks }) => (
								<article key={day} className="rounded-2xl border border-foreground/10 bg-background p-4">
									<p className="text-xs font-extrabold uppercase tracking-wide text-primary">Day {day}</p>
									<h4 className="mt-1 font-bold">{focus}</h4>
									<ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
										{tasks.map((task, index) => <li key={`${index}-${task}`}>{task}</li>)}
									</ul>
								</article>
							))}
						</div>
					</section>
				</div>
			) : null}
		</section>
	);
}
