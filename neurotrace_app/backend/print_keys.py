import pickle
from pathlib import Path
MODEL_DIR = Path('models')
with open(MODEL_DIR / 'preprocessing.pkl', 'rb') as f:
    prep = pickle.load(f)
print("KEYS:", sorted(list(prep.keys())))
print("FIRST 5 NAMES:", prep['feat_names_sel'][:5])
