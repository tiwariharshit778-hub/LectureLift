import {
	AudioLines,
	Download,
	FileText,
	FolderOpen,
	Layers,
	ListChecks,
	Network,
	Upload,
} from 'lucide-react';

export const NAV_LINKS = [
	{ label: 'Features', href: '#features' },
	{ label: 'How it Works', href: '#how-it-works' },
	{ label: 'Pricing', href: '#pricing' },
	{ label: 'FAQ', href: '#faq' },
];

export const FEATURES = [
	{
		icon: AudioLines,
		title: 'Smart Transcription',
		description: 'Whisper-powered transcription turns hours of audio into accurate, timestamped text in minutes.',
		size: 'large',
	},
	{
		icon: FileText,
		title: 'Revision Notes',
		description: 'Structured notes with headings, bullets and highlighted key terms — ready to revise from.',
		size: 'small',
	},
	{
		icon: Layers,
		title: 'Flashcards',
		description: '15–25 spaced-repetition flashcards generated from every lecture, automatically.',
		size: 'large',
	},
	{
		icon: ListChecks,
		title: 'Quizzes with explanations',
		description: 'Multiple-choice quizzes that explain why each answer is right or wrong.',
		size: 'small',
	},
	{
		icon: Network,
		title: 'Mind Maps',
		description: 'Interactive, expandable mind maps that show how every concept connects.',
		size: 'small',
	},
	{
		icon: Upload,
		title: 'MP3 or MP4 upload',
		description: 'Drag in any lecture recording up to 100 MB — audio or video both work.',
		size: 'small',
	},
	{
		icon: FolderOpen,
		title: 'Organize by subject',
		description: 'Tag every lecture with a subject and filter your library in one click.',
		size: 'small',
	},
	{
		icon: Download,
		title: 'Export notes',
		description: 'Export notes as Markdown or print them to PDF for offline revision.',
		size: 'small',
	},
];

export const STATS = [
	{ value: 10000, suffix: '+', label: 'lectures processed' },
	{ value: 50000, suffix: '+', label: 'flashcards generated' },
	{ value: 25000, suffix: '+', label: 'quizzes taken' },
];

export const TESTIMONIALS = [
	{
		name: 'Amara Osei',
		role: 'Medical student, King\'s College London',
		quote: 'I used to spend my evenings re-listening to lectures at 1.5x. Now I upload them on the walk home and the flashcards are waiting for me.',
	},
	{
		name: 'Jonas Weber',
		role: 'Law student, Humboldt University',
		quote: 'The quizzes are the killer feature. The explanations read like a patient tutor, not an answer key.',
	},
	{
		name: 'Priya Nair',
		role: 'Engineering student, TU Delft',
		quote: 'Mind maps from a 90-minute thermodynamics lecture, in four minutes. My revision notes have never been this organized.',
	},
	{
		name: 'Sofia Rossi',
		role: 'Economics student, Bocconi',
		quote: 'I filter by subject before every exam session and study only what matters. It feels like the app reads the syllabus for me.',
	},
	{
		name: 'Daniel Kim',
		role: 'CS student, TU Munich',
		quote: 'The transcript search alone is worth it. I jump straight to the moment the professor explained the tricky part.',
	},
	{
		name: 'Lucía Fernández',
		role: 'Psychology student, Universidad de Barcelona',
		quote: 'Study mode cycling my unknown cards back around is exactly how I used to do it by hand — except it takes zero effort now.',
	},
];

export const PRICING = {
	monthly: [
		{ name: 'Free', price: 0, description: 'Try LectureLift on your first lectures.', features: ['3 lectures per month', 'Transcripts & notes', '10 flashcards per lecture', 'Community support'], cta: 'Start Free', highlighted: false },
		{ name: 'Pro', price: 8, description: 'For students who revise every week.', features: ['Unlimited lectures', 'Everything in Free', 'Full flashcard decks & quizzes', 'Mind maps & exports', 'Priority processing'], cta: 'Go Pro', highlighted: true },
		{ name: 'Team', price: 24, description: 'For study groups and societies.', features: ['Everything in Pro', '5 seats included', 'Shared subjects library', 'Group quiz leaderboards'], cta: 'Contact Us', highlighted: false },
	],
	yearly: [
		{ name: 'Free', price: 0, description: 'Try LectureLift on your first lectures.', features: ['3 lectures per month', 'Transcripts & notes', '10 flashcards per lecture', 'Community support'], cta: 'Start Free', highlighted: false },
		{ name: 'Pro', price: 6, description: 'For students who revise every week.', features: ['Unlimited lectures', 'Everything in Free', 'Full flashcard decks & quizzes', 'Mind maps & exports', 'Priority processing'], cta: 'Go Pro', highlighted: true },
		{ name: 'Team', price: 19, description: 'For study groups and societies.', features: ['Everything in Pro', '5 seats included', 'Shared subjects library', 'Group quiz leaderboards'], cta: 'Contact Us', highlighted: false },
	],
};

export const FAQS = [
	{
		question: 'What file formats can I upload?',
		answer: 'LectureLift accepts MP3 audio and MP4 video recordings up to 100 MB. Most phone voice-memo apps and lecture capture tools export exactly these formats.',
	},
	{
		question: 'How long does processing take?',
		answer: 'A typical 60-minute lecture is transcribed and turned into notes, flashcards, a quiz and a mind map in about 3–5 minutes. You can watch each step live from your dashboard.',
	},
	{
		question: 'Are my recordings private?',
		answer: 'Yes. Files are stored in a private bucket that only your account can access, and every row in the database is scoped to your user. We never train on your lectures.',
	},
	{
		question: 'Can I edit the generated notes and flashcards?',
		answer: 'Flashcards support study states (known / unknown) and spaced repetition scheduling. Notes can be exported as Markdown so you can edit them anywhere.',
	},
	{
		question: 'What happens if processing fails?',
		answer: 'Partial results are always kept — if the quiz generation fails but the transcript succeeded, you keep the transcript and can retry the rest with one click.',
	},
	{
		question: 'Is there a free plan?',
		answer: 'Yes, the Free plan includes 3 lectures per month with transcripts, notes and flashcards. No credit card required — just sign up and upload.',
	},
];
