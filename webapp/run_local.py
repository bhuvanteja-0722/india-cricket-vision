from __future__ import annotations
import json, mimetypes, os, re, sys, time, warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError
import joblib
import numpy as np
import torch
import torch.nn.functional as F
from facenet_pytorch import InceptionResnetV1, MTCNN

ROOT = Path(__file__).resolve().parent
MODEL_FILE = ROOT / "face_classifier.joblib"
METRICS_FILE = ROOT / "metrics.json"
STATIC = ROOT / "static"
DEVICE = torch.device("mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu")
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

class Predictor:
    def __init__(self):
        self.bundle = joblib.load(MODEL_FILE)
        self.classes = self.bundle["classes"]
        self.encoder = InceptionResnetV1(pretrained="vggface2").eval().to(DEVICE)
        self.detector = MTCNN(image_size=160, margin=20, min_face_size=40,
            thresholds=[0.6, 0.7, 0.7], factor=0.709, post_process=True, device=DEVICE)

    def predict(self, image):
        image = ImageOps.exif_transpose(image).convert("RGB")
        face = self.detector(image)
        detected = face is not None
        if face is None:
            # Match the training pipeline's full-frame fallback when MTCNN finds no face.
            image = ImageOps.fit(image, (160, 160))
            arr = np.asarray(image, dtype=np.float32) / 255.0
            face = torch.from_numpy(arr).permute(2, 0, 1).mul(2).sub(1)
        batch = face.unsqueeze(0).to(DEVICE)
        with torch.inference_mode():
            emb = F.normalize(self.encoder(batch), p=2, dim=1).cpu().numpy().astype(np.float32)
        classifier = self.bundle["classifier"]
        probs = classifier.predict_proba(emb)[0]
        ids = np.argsort(probs)[::-1][:5]
        matches = [{"name": self.classes[int(i)], "confidence": round(float(probs[i]) * 100, 2)} for i in ids]
        confidence = matches[0]["confidence"]
        return {"player": matches[0]["name"], "confidence": confidence,
            "accepted": True, "top_matches": matches, "latency_ms": round(1000 * (time.perf_counter()-started), 1),
            "device": str(DEVICE), "face_detected": detected}

predictor = None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)
    def send_bytes(self, status, body, content_type):
        self.send_response(status); self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(body)
    def send_json(self, status, data):
        self.send_bytes(status, json.dumps(data).encode(), "application/json; charset=utf-8")
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            metrics = json.loads(METRICS_FILE.read_text())
            self.send_json(200, {"model_ready": predictor is not None, "device": str(DEVICE), "classes": len(predictor.classes) if predictor else 0, "metrics": metrics, "history": {}}); return
        if path == "/api/health":
            self.send_json(200, {"ok": True, "model_ready": predictor is not None}); return
        if path == "/" or path == "/index.html":
            body = (ROOT / "templates" / "index.html").read_bytes()
            self.send_bytes(200, body, "text/html; charset=utf-8"); return
        rel = path.removeprefix("/static/")
        if path.startswith("/static/") and ".." not in rel:
            file = STATIC / rel
            if file.is_file():
                typ = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
                self.send_bytes(200, file.read_bytes(), typ); return
        self.send_error(404)
    def do_POST(self):
        if self.path != "/api/predict": self.send_error(404); return
        ctype = self.headers.get("Content-Type", "")
        match = re.search(r"boundary=(?:\"([^\"]+)\"|([^;]+))", ctype)
        if not match: self.send_json(400, {"detail":"Expected an uploaded image."}); return
        length = int(self.headers.get("Content-Length", "0"))
        if length > 13 * 1024 * 1024: self.send_json(413, {"detail":"Image exceeds 12 MB."}); return
        raw = self.rfile.read(length)
        boundary = (match.group(1) or match.group(2)).encode()
        parts = raw.split(b"--" + boundary)
        image_data = next((part.split(b"\r\n\r\n",1)[1].rsplit(b"\r\n",1)[0] for part in parts if b'name="file"' in part and b"\r\n\r\n" in part), None)
        if image_data is None: self.send_json(400, {"detail":"No image was attached."}); return
        try:
            image = Image.open(BytesIO(image_data)); image.verify(); image = Image.open(BytesIO(image_data))
        except (UnidentifiedImageError, OSError): self.send_json(400, {"detail":"Invalid image."}); return
        global started
        started = time.perf_counter()
        try: self.send_json(200, predictor.predict(image))
        except Exception as exc:
            print(f"Prediction error: {exc!r}", flush=True)
            self.send_json(503, {"detail":"Prediction failed. See the local server log."})

if __name__ == "__main__":
    print(f"Loading FaceNet classifier on {DEVICE}...", flush=True)
    predictor = Predictor()
    port = int(os.environ.get("PORT", "8000"))
    print("Model ready: %s classes. Opening http://127.0.0.1:%s" % (len(predictor.classes), port), flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
