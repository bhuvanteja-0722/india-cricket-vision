# Indian Cricketer Face Recognition Project

India Cricket Vision is a local face-matching web app for Indian cricketer portraits. The runnable app and bundled inference model are in [`webapp/`](webapp/).

## Run locally

```bash
cd webapp
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-local.txt
TORCH_HOME="$PWD/.torch-cache" python run_local.py
```

Open <http://127.0.0.1:8000>. The first launch downloads FaceNet VGGFace2 encoder weights; later launches use the local cache. Set `PORT=8001` to choose another port.

The app includes a 323-class calibrated LinearSVC classifier and metrics from the supplied completed run. It reports 72.8% held-out test accuracy and 68.4% test macro-F1 on 7,674 usable images. The Kaggle dataset is needed for retraining, but not for running inference. Uploads are processed locally; the preview clears after analysis, while up to 12 compressed thumbnails and results are kept in browser local storage.

Model scores rank the known classes; they are not verified identity probabilities, and unknown-player rejection has not been validated.

## Deploy on Render

The repository-root [`render.yaml`](render.yaml) configures a Render Web Service with `webapp/` as its root directory. In Render, create a Blueprint from this repository, or set the service fields to:

- Root Directory: `webapp`
- Build Command: `pip install --no-cache-dir -r requirements.txt`
- Start Command: `python run_local.py`
- Health Check Path: `/api/health`

Render installs CPU-only PyTorch wheels to avoid the NVIDIA CUDA packages. The FaceNet VGGFace2 weights download on first startup and are cached in Render's temporary filesystem.

**Free-plan memory note:** Render Free provides 512 MB RAM, not a 512 MB storage quota. The earlier FaceNet startup exceeded that memory. This setup reduces the deployment footprint while retaining the existing model and architecture, but the free instance can still run out of RAM; if it does, use a plan with more memory.

## Data and credits

The training dataset is [Indian Cricketers Dataset on Kaggle](https://www.kaggle.com/datasets/aviratgupta/indian-cricketers-dataset). Image and logo sources and licenses are listed in [`webapp/Background image credits.md`](webapp/Background%20image%20credits.md).

This is an independent educational project and is not affiliated with BCCI or ICC.
