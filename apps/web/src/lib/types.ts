import type { RecordModel } from 'pocketbase';

export type LectureStatus = 'pending' | 'transcribing' | 'generating' | 'ready' | 'failed';

export interface LectureRecord extends RecordModel {
	user: string;
	title: string;
	subject: string;
	description: string;
	file: string;
	file_type: 'audio' | 'video';
	status: LectureStatus;
	error_message: string;
	duration_seconds: number;
}

export interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

/**
 * What's actually stored in `TranscriptRecord.segments` (a JSON field) — the
 * timed segments plus the full transcript text. `content` (a plain text
 * field) is capped at 5000 characters by a PocketBase schema limit this app
 * can't raise on every environment it runs in, so it only ever holds a
 * preview; `fullText` here is the untruncated transcript. See the comment on
 * `TRANSCRIPT_CONTENT_PREVIEW_MAX` in pipeline.server.ts for why.
 */
export interface TranscriptStorage {
	segments: TranscriptSegment[];
	fullText: string;
}

export interface TranscriptRecord extends RecordModel {
	lecture: string;
	/** Preview only, capped at 5000 characters — see `TranscriptStorage.fullText`. */
	content: string;
	segments: TranscriptStorage;
}

export interface NoteSection {
	heading: string;
	bullets: string[];
	key_terms: string[];
}

export interface NotesContent {
	title: string;
	summary: string;
	sections: NoteSection[];
}

export interface NoteRecord extends RecordModel {
	lecture: string;
	content: NotesContent;
}

export type ReviewState = 'new' | 'known' | 'unknown';

export interface FlashcardRecord extends RecordModel {
	lecture: string;
	question: string;
	answer: string;
	review_state: ReviewState;
	last_reviewed_at: string;
	next_review_at: string;
}

/**
 * What's actually stored in `QuizQuestionRecord.options` (a JSON field) — the
 * four options plus which one is correct. `correct_index` (the record's own
 * dedicated `number` field) can't hold this: PocketBase's `required`
 * validation on `number` fields treats `0` as blank (Go's zero-value
 * convention), and 0 is a completely valid, common "the first option is
 * correct" answer — every question where that happened failed to save with
 * "correct_index: Cannot be blank." See the write site in pipeline.server.ts
 * for why the dedicated field still gets written (a harmless placeholder, to
 * satisfy its own required+min+max constraints) but is never read from.
 */
export interface QuizOptions {
	list: string[];
	correctIndex: number;
}

export interface QuizQuestionRecord extends RecordModel {
	lecture: string;
	question: string;
	options: QuizOptions;
	/** Placeholder only — never read. See `QuizOptions.correctIndex`. */
	correct_index: number;
	explanation: string;
}

export interface QuizAttemptRecord extends RecordModel {
	lecture: string;
	score: number;
	total: number;
}

export interface MindMapNode {
	topic: string;
	children?: MindMapNode[];
}

export interface MindMapRecord extends RecordModel {
	lecture: string;
	structure: MindMapNode;
}
