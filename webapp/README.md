# India Cricket Vision web app

A local web app for ranking Indian cricketer portraits against the bundled 323-class model. It uses FaceNet VGGFace2 embeddings and a calibrated LinearSVC classifier. Uploaded images are processed by the local server; the upload preview clears after analysis. The browser keeps up to 12 compressed thumbnails and results in local storage.

## Run locally

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
TORCH_HOME="$PWD/.torch-cache" python run_local.py
```

Open <http://127.0.0.1:8000>. The first launch downloads the pretrained FaceNet encoder weights into `.torch-cache`; later launches can use the cached weights. Set `PORT=8001` to use another local port.

The classifier and training metrics are included. The Kaggle training dataset is not needed for inference. The summary metrics are retained from the supplied model run: 72.8% held-out test accuracy and 68.4% test macro-F1 across 7,674 usable images and 323 classes. Ranking scores are not verified identity probabilities, and unknown-player rejection is not validated.

## Image credits

See [Background image credits](Background%20image%20credits.md) for stadium photo licenses and the BCCI logo source. This is an independent educational project and is not affiliated with BCCI or ICC.
