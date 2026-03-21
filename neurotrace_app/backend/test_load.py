import pickle
import sys
import json
import traceback
from pathlib import Path

# Mock classes that might be missing in the pickle namespace
class _ProbWrap:
    def __init__(self, model): self.model = model
    def predict(self, X): return self.model.predict(X)

sys.modules['__main__']._ProbWrap = _ProbWrap

MODEL_DIR = Path('models')
sys.path.append(str(MODEL_DIR))

def test():
    print("Testing loads from:", MODEL_DIR.absolute())
    try:
        print("1. Loading preprocessing.pkl...")
        with open(MODEL_DIR / 'preprocessing.pkl', 'rb') as f:
            prep = pickle.load(f)
        print("✅ PREP loaded")
        print("PREP keys:", list(prep.keys()))
        
        print("2. Loading student_aim.pkl...")
        with open(MODEL_DIR / 'student_aim.pkl', 'rb') as f:
            aim = pickle.load(f)
        print("✅ AIM bundle loaded")
        
        from student_aim_inference import StudentAIM
        model = StudentAIM(aim, prep)
        print("✅ Model initialized")
        
    except Exception:
        print("❌ LOAD FAILED")
        traceback.print_exc()

if __name__ == "__main__":
    test()
