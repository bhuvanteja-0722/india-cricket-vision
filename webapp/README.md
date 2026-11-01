# India Cricket Vision web app

A face-matching web app for Indian cricketer portraits. It uses the bundled 323-class classifier and FaceNet VGGFace2 embeddings. Uploaded images are processed by the server; the upload preview clears after analysis. The browser keeps up to 12 compressed thumbnails and results in local storage.

## Run locally

Use Python 3.12:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-local.txt
TORCH_HOME="$PWD/.torch-cache" python run_local.py
```

Open <http://127.0.0.1:8000>. The first launch downloads pretrained FaceNet encoder weights into `.torch-cache`; later launches can use the cached weights. Set `PORT=8001` to use another local port.

## Deploy to Render

The repository root includes a `render.yaml` Blueprint configured for this folder. Create a Blueprint from the repository, or create a Web Service with:

- Root Directory: `webapp`
- Runtime: Python 3.12
- Build Command: `pip install --no-cache-dir -r requirements.txt`
- Start Command: `python run_local.py`
- Health Check Path: `/api/health`

The deployment requirements select CPU-only PyTorch wheels so pip does not pull NVIDIA CUDA packages. VGGFace2 encoder weights are downloaded on the first start and cached under `/tmp/torch-cache`.

Render Free has 512 MB RAM. The existing model and architecture are unchanged; the CPU-only build reduces package overhead, but the FaceNet model may still exceed Free instance memory during startup. The project previously hit that limit, so a higher-memory plan may be needed if it OOMs again.

## Model and privacy notes

The classifier and training metrics are included. The Kaggle training dataset is not required for inference. Supplied metrics are 72.8% held-out test accuracy and 68.4% test macro-F1 across 7,674 usable images and 323 classes. Ranking scores are not verified identity probabilities, and unknown-player rejection has not been validated.

See [Background image credits](Background%20image%20credits.md) for stadium photo licenses and the BCCI logo source. This is an independent educational project and is not affiliated with BCCI or ICC.
