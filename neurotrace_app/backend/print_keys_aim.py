import pickle
from pathlib import Path
MODEL_DIR = Path('models')
with open(MODEL_DIR / 'student_aim.pkl', 'rb') as f:
    class _ProbWrap:
        def __init__(self, m): self.model = m
    import sys
    sys.modules['__main__']._ProbWrap = _ProbWrap
    aim = pickle.load(f)
print("AIM KEYS:", sorted(list(aim.keys())))
