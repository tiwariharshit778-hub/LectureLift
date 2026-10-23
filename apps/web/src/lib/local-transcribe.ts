/**
 * Client-side Whisper transcription via Transformers.js (WebGPU, WASM fallback).
 *
 * Runs the Whisper model directly in the browser so we avoid the round-trip to
 * the remote Whisper API for the common case. If anything goes wrong (no
 * WebGPU/WASM, model download failure, decode failure) the caller falls back to
 * the server-side Whisper API.
 *
 * The Transformers.js dependency is imported dynamically so this module is safe
 * to import from an SSR'd route — the heavy browser-only code only loads in the
 * client when transcription actually runs.
 */
import type { TranscriptSegment } from '@/lib/types';

const MODEL_ID = 'onnx-community/whisper-base';

export interface LocalTranscript {
	text: string;
	segments: TranscriptSegment[];
	duration: number | null;
}

export type ProgressCb = (msg: string, pct: number) => void;

let transcriberPromise: Promise<unknown> | null = null;

function hasWebGpu() {
	return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

interface TransformersModule {
	pipeline: (
		task: string,
		model: string,
		opts?: Record<string, unknown>,
	) => Promise<unknown>;
	env: { allowLocalModels: boolean; allowRemoteModels: boolean };
}

// Load Transformers.js from the CDN at runtime so we don't need a heavy npm
// dependency installed in the sandbox. A variable specifier keeps TypeScript
// from trying to resolve it at build time.
const TRANSFORMERS_URL =
	'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';

async function loadTransformers(): Promise<TransformersModule> {
	const specifier = TRANSFORMERS_URL;
	const mod = (await import(/* @vite-ignore */ specifier)) as TransformersModule;
	mod.env.allowLocalModels = false;
	mod.env.allowRemoteModels = true;
	return mod;
}

/**
 * Lazily load the Whisper pipeline. Cached so subsequent lectures reuse it.
 */
async function getTranscriber(onProgress?: ProgressCb) {
	if (!transcriberPromise) {
		const device = hasWebGpu() ? 'webgpu' : 'wasm';
		onProgress?.(`Loading Whisper (${device.toUpperCase()})…`, 5);
		const { pipeline } = await loadTransformers();
		transcriberPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
			device,
			dtype: device === 'webgpu' ? 'fp32' : 'q8',
			progress_callback: (data: { status?: string; progress?: number; file?: string }) => {
				if (data.status === 'progress' && typeof data.progress === 'number') {
					onProgress?.('Downloading Whisper model…', Math.min(95, Math.round(data.progress)));
				} else if (data.status === 'ready') {
					onProgress?.('Model ready', 98);
				}
			},
		}).catch((err) => {
			// Reset so a later attempt can retry (e.g. WebGPU failed → try WASM).
			transcriberPromise = null;
			throw err;
		});
	}
	return transcriberPromise;
}

/**
 * Decode an audio/video File into 16 kHz mono Float32Array samples using the
 * Web Audio API. MP4 video files are decoded from their audio track.
 */
async function decodeToPcm(file: File): Promise<Float32Array> {
	const arrayBuffer = await file.arrayBuffer();
	const AudioCtx: typeof AudioContext =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const tmpCtx = new AudioCtx();
	let decoded: AudioBuffer;
	try {
		decoded = await tmpCtx.decodeAudioData(arrayBuffer);
	} finally {
		tmpCtx.close().catch(() => {});
	}

	const targetRate = 16000;
	const channel = decoded.getChannelData(0);
	const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
	const src = offline.createBufferSource();
	// Resample: copy original buffer into the offline graph at the target rate.
	const resampled = offline.createBuffer(1, channel.length, decoded.sampleRate);
	resampled.copyToChannel(channel, 0);
	src.buffer = resampled;
	src.connect(offline.destination);
	src.start();
	const rendered = await offline.startRendering();
	return rendered.getChannelData(0);
}

interface WhisperChunk {
	timestamp: [number, number] | null;
	text: string;
}

interface WhisperOutput {
	text: string;
	chunks?: WhisperChunk[];
}

interface TranscriberFn {
	(input: Float32Array, opts: Record<string, unknown>): Promise<WhisperOutput>;
}

/**
 * Transcribe a file locally. Throws on any failure so the caller can fall back
 * to the remote Whisper API.
 */
export async function transcribeLocally(file: File, onProgress?: ProgressCb): Promise<LocalTranscript> {
	onProgress?.('Preparing audio…', 2);
	const samples = await decodeToPcm(file);

	const transcriber = (await getTranscriber(onProgress)) as TranscriberFn;

	onProgress?.('Transcribing on-device…', 50);
	const output = await transcriber(samples, {
		return_timestamps: true,
		chunk_length_s: 30,
		stride_length_s: 5,
	});

	const chunks = output.chunks ?? [];
	const segments: TranscriptSegment[] = chunks.map((c) => ({
		start: c.timestamp?.[0] ?? 0,
		end: c.timestamp?.[1] ?? (c.timestamp?.[0] ?? 0),
		text: c.text.trim(),
	}));

	const text = (output.text || segments.map((s) => s.text).join(' ')).trim();
	if (!text) throw new Error('Local transcription returned no text.');

	const duration = segments.length > 0 ? segments[segments.length - 1].end || null : null;
	onProgress?.('Transcription complete', 100);
	return { text, segments, duration };
}

export function isLocalTranscribeSupported() {
	return typeof window !== 'undefined' && typeof AudioContext !== 'undefined';
}
