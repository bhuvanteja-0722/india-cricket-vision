# Indian Cricket Team Face Identification

This project builds a **face recognition** system that can identify Indian cricket team members from a photograph.

## Features
- Uses a pre‑trained **EfficientNet‑B0** backbone fine‑tuned on the provided cricketer face dataset.
- Simple training script (`train.py`) with validation, checkpointing and learning‑rate scheduling.
- Inference script (`predict.py`) that takes an image, detects the face (MTCNN) and returns the predicted player name.
- Interactive **Streamlit** UI (`app.py`) with a **BCCI theme** – the background shows famous Indian cricket stadiums and trophy‑lifting photos.
- Model, label‑encoder and inference code are packaged in the `models/` folder for easy deployment.

## Directory layout
```
cricket_face_id/
│   README.md
│   requirements.txt
│
└───src/
    │   train.py
    │   predict.py
    │   app.py
    │   utils.py
    │
    └───models/   # generated after training
│
└───data/          # symbolic link or copy of the Kaggle dataset
```

## Getting started
1. **Create a virtual environment** and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # macOS/Linux
   pip install -r requirements.txt
   ```
2. **Prepare the data** – the script expects the dataset in the following structure (already present in your downloads):
   ```
   data/
   └───<player_name>/
       ├── img1.jpg
       ├── img2.jpg
       …
   ```
   You can create a symlink:
   ```bash
   ln -s "/Users/bhuvantejaponakala/Downloads/indian cricketer" cricket_face_id/data
   ```
3. **Train the model**:
   ```bash
   python src/train.py --data_dir data --epochs 20 --batch_size 32
   ```
   The best checkpoint will be saved to `src/models/best.pt`.
4. **Run the web app**:
   ```bash
   streamlit run src/app.py
   ```
   Upload a player photo and the app will display the identified name on a BCCI‑styled background.

## Customising the theme
Replace the URLs in `app.py` (`STADIUM_IMG_URL` and `TROPHY_IMG_URL`) with your own high‑resolution images of Indian stadiums or trophy‑lifting moments.

---
*Built with PyTorch, torchvision, facenet‑pytorch (MTCNN) and Streamlit.*