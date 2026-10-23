"""Local OpenAI-compatible transcription endpoint for LectureLift development.

Uses faster-whisper already installed in the user's Whisper virtual environment.
Binds only to 127.0.0.1:8765; do not expose this server to the public internet.
"""
from __future__ import annotations

import json
import os
import tempfile
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

_CUDA_DLL_HANDLES = []
if os.name == "nt":
    from nvidia import cublas, cuda_nvrtc, cudnn

    cuda_dll_dirs = []
    for package in (cublas, cudnn, cuda_nvrtc):
        package_dir = Path(next(iter(package.__path__))) / "bin"
        if package_dir.is_dir():
            _CUDA_DLL_HANDLES.append(os.add_dll_directory(str(package_dir)))
            cuda_dll_dirs.append(str(package_dir))
    os.environ["PATH"] = os.pathsep.join(cuda_dll_dirs + [os.environ.get("PATH", "")])

from faster_whisper import WhisperModel

HOST = "127.0.0.1"
PORT = 8765
API_KEY = os.environ.get("LOCAL_WHISPER_API_KEY", "local-dev-token")
MODEL_NAME = os.environ.get("LOCAL_WHISPER_MODEL", "large-v3-turbo")
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB


def load_model() -> WhisperModel:
    """Load the local model on CUDA with an 8-bit/FP16 compute type."""
    print(f"Loading {MODEL_NAME} on cuda (int8_float16)...", flush=True)
    model = WhisperModel(MODEL_NAME, device="cuda", compute_type="int8_float16")
    print("Whisper model loaded. Local API is ready.", flush=True)
    return model


MODEL = load_model()


class Handler(BaseHTTPRequestHandler):
    server_version = "LectureLiftLocalWhisper/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/health":
            self._send_json(200, {"ok": True, "model": MODEL_NAME})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/v1/audio/transcriptions":
            self._send_json(404, {"error": "Not found"})
            return

        if self.headers.get("Authorization", "") != f"Bearer {API_KEY}":
            self._send_json(401, {"error": "Invalid local Whisper API token"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length"})
            return
        if length <= 0:
            self._send_json(400, {"error": "Empty request body"})
            return
        if length > MAX_UPLOAD_BYTES:
            self._send_json(413, {"error": "Audio file is larger than the local 200 MB limit"})
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type.lower():
            self._send_json(400, {"error": "Expected multipart/form-data"})
            return

        raw = self.rfile.read(length)
        mime_message = BytesParser(policy=default).parsebytes(
            b"Content-Type: " + content_type.encode("ascii", "replace")
            + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw
        )
        audio_bytes = None
        filename = "lecture.mp3"
        for part in mime_message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if name == "file":
                audio_bytes = part.get_payload(decode=True)
                filename = Path(part.get_filename() or "lecture.mp3").name
                break

        if not audio_bytes:
            self._send_json(400, {"error": "No audio file was attached"})
            return

        suffix = Path(filename).suffix.lower()
        if not suffix or len(suffix) > 8 or not suffix[1:].isalnum():
            suffix = ".mp3"

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            print(f"Transcribing upload: {filename} ({len(audio_bytes) / (1024 * 1024):.1f} MB)", flush=True)
            segments_iter, info = MODEL.transcribe(
                tmp_path,
                beam_size=5,
                vad_filter=True,
            )
            segments = []
            text_parts = []
            for index, segment in enumerate(segments_iter):
                segment_text = segment.text.strip()
                if segment_text:
                    text_parts.append(segment_text)
                    segments.append({
                        "id": index,
                        "start": float(segment.start),
                        "end": float(segment.end),
                        "text": segment_text,
                    })

            transcript = " ".join(text_parts).strip()
            if not transcript:
                self._send_json(422, {"error": "Whisper returned an empty transcript"})
                return

            print(f"Transcription complete: {len(transcript)} characters", flush=True)
            self._send_json(200, {
                "text": transcript,
                "duration": float(info.duration) if info.duration is not None else None,
                "segments": segments,
                "language": getattr(info, "language", None),
            })
        except Exception as exc:
            print(f"Whisper transcription error: {type(exc).__name__}: {exc}", flush=True)
            self._send_json(500, {"error": "Local Whisper failed; check the Python terminal for details"})
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    def log_message(self, fmt: str, *args) -> None:
        print(f"[HTTP] {self.address_string()} - {fmt % args}", flush=True)


def main() -> None:
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Listening at http://{HOST}:{PORT}", flush=True)
    print("Health check: http://127.0.0.1:8765/health", flush=True)
    print("Leave this terminal running while testing LectureLift.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping local Whisper API...", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
