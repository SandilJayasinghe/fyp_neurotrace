import numpy as np
import math
from typing import List, Optional, Dict, Any

# --- Notebook Verbatim Functions (Step 4 Requirement) ---

class _ProbWrap:
    """Compatibility shim for scikit-learn probability wrappers."""
    def __init__(self, *args, **kwargs): pass
    def __setstate__(self, state): self.__dict__.update(state)
    def __getstate__(self): return self.__dict__

def _stats(x):
    m = np.mean(x)
    s = np.std(x)
    if s < 1e-10:
        return m, 0., 0., 0., 0.
    z = (x - m) / s
    kurt = float((z**4).mean() - 3.)
    return m, s, float((z**3).mean()), kurt, s / (m + 1e-8)

def _shannon_entropy(x, bins=10):
    if len(x) < 2: return 0.0
    counts, _ = np.histogram(x, bins=bins)
    p = counts / counts.sum()
    p = p[p > 0]
    return -np.sum(p * np.log2(p))

def _dfa_alpha(x):
    n = len(x)
    if n < 16: return 0.75
    y = np.cumsum(x - x.mean())
    box_sizes = np.unique(np.round(np.logspace(np.log10(4), np.log10(max(n//4, 5)), 8)).astype(int))
    box_sizes = box_sizes[(box_sizes >= 4) & (box_sizes <= n//2)]
    if len(box_sizes) < 3: return 0.75
    flucts = []
    for b in box_sizes:
        nb = n // b
        if nb < 2: continue
        seg = y[:nb*b].reshape(nb, b)
        t = np.arange(b, dtype=np.float64)
        tm = t.mean()
        t2 = ((t-tm)**2).sum()
        slope_v = ((seg - seg.mean(1, keepdims=True)) * (t - tm)).sum(1) / t2
        trend = slope_v[:, None] * (t - tm) + seg.mean(1, keepdims=True)
        flucts.append(np.sqrt(((seg - trend)**2).mean()))
    if len(flucts) < 3:
        return 0.75
    log_f = np.array(flucts)
    log_f = np.where(log_f <= 0, 1e-10, log_f)
    try:
        alpha = np.polyfit(np.log10(box_sizes[:len(flucts)]), np.log10(log_f), 1)[0]
    except Exception:
        return 0.75
    return float(np.clip(alpha, 0., 2.))

def _perm_entropy_complexity(x, order=3):
    n = len(x)
    n_patterns = math.factorial(order)
    if n < order + 1: 
        return 0.5, 0.0
    x = np.ascontiguousarray(x, dtype=np.float64)
    shape = (n - order + 1, order)
    wins = np.lib.stride_tricks.as_strided(x, shape=shape, strides=(x.strides[0], x.strides[0])).copy()
    ranks = np.argsort(wins, axis=1)
    powers = np.array([order**i for i in range(order-1, -1, -1)])
    idx = (ranks * powers).sum(axis=1) % n_patterns
    counts = np.bincount(idx, minlength=n_patterns).astype(np.float64)
    p = counts / counts.sum()
    p_nz = p[p > 0]
    H = float(np.clip(-np.sum(p_nz * np.log2(p_nz)) / np.log2(n_patterns), 0., 1.))
    def _sh(q):
        q2 = q[q > 0]
        return -np.sum(q2 * np.log2(q2))
    p_u = np.ones(n_patterns) / n_patterns
    m = (p + p_u) / 2.
    JS = max(_sh(m) - 0.5 * _sh(p) - 0.5 * _sh(p_u), 0.)
    return H, float(np.clip(H * JS, 0., 1.))

def _bigram_features(keys, lat):
    if keys is None or len(keys) < 2: return [0.] * 15
    bg = {}
    for i in range(len(keys)-1):
        k = (keys[i], keys[i+1])
        if k not in bg: bg[k] = []
        bg[k].append(lat[i+1])
    top = sorted(bg.items(), key=lambda x: -len(x[1]))[:5]
    feats = []
    for _, lats in top:
        a = np.array(lats, dtype=np.float64)
        m = a.mean()
        feats += [float(m), float(a.std() / (m+1e-8)), float(np.percentile(a, 90) - np.percentile(a, 10))]
    while len(feats) < 15: feats.append(0.)
    return feats

def extract_features(ht, ft, lat, key=None):
    ht = np.array(ht)
    ft = np.array(ft)
    lat = np.array(lat)
    
    # 1-10: HT Stats
    hm, hs, hsk, hku, hcv = _stats(ht)
    ht_f = [hm, float(np.median(ht)), hs, float(np.percentile(ht, 75) - np.percentile(ht, 25)), 
            float(ht.max()), float(np.percentile(ht, 10)), float(np.percentile(ht, 90)), hsk, hku, hcv]
    
    # 11-18: FT Stats
    fm, fs, fsk, fku, fcv = _stats(ft)
    ft_f = [fm, float(np.median(ft)), fs, float(np.percentile(ft, 75) - np.percentile(ft, 25)), 
            float(ft.max()), float(np.percentile(ft, 90)), fsk, fcv]
    
    # 19-26: Latency Stats
    lm, ls, lsk, lku, lcv = _stats(lat)
    lat_f = [lm, float(np.median(lat)), ls, float(np.percentile(lat, 90)), float(lat.max()), 
             float(np.percentile(lat, 10)), lsk, lcv]
    
    # 27-30: Hand Transitions
    if key is not None:
        _L = set('`12345qwertasdfgzxcvbQWERTASDFGZXCVB')
        _R = set("67890-=yuiophjklnmYUIOPHJKLNM[];'\\,./")
        h = np.array([0 if str(k)[:1] in _L else (1 if str(k)[:1] in _R else 2) for k in key])
        hand_f = [float(np.median(lat[1:][(h[:-1]==a)&(h[1:]==b)])) if ((h[:-1]==a)&(h[1:]==b)).any() else lm 
                  for a,b in [(0,0), (0,1), (1,0), (1,1)]]
    else: hand_f = [lm] * 4

    # 31-36: Tremor, Slope, Burst, Rhythm, Autocorr
    tpow = tfreq = 0.0
    if len(ht) >= 32:
        try:
            yf = np.abs(np.fft.fft(ht - hm))[:len(ht)//2]
            xf = np.fft.fftfreq(len(ht), 1/125.0)[:len(ht)//2]
            idx = (xf > 0) & (xf < 12.0)
            if idx.any():
                tpow = float(yf[idx].max())
                tfreq = float(xf[idx][np.argmax(yf[idx])])
        except Exception as e:
            print(f"Tremor Feature Error: {e}")
    
    slope = float(np.polyfit(np.arange(len(ht)), ht, 1)[0]) if len(ht) >= 10 else 0.0
    def _b(x): return float((x > (np.mean(x) + 1.5*np.std(x))).sum() / len(x)) if len(x)>5 else 0.0
    autoc = float(np.corrcoef(ht[:-1], ht[1:])[0,1]) if len(ht) >= 10 else 0.0
    
    # 37-39: Entropy, Velocity, Correlation
    ent = _shannon_entropy(ht)
    vel = float(np.sqrt((np.diff(ht)**2).mean()))
    hfc = float(np.corrcoef(ht, ft)[0,1]) if len(ht) >= 10 else 0.0
    
    # 40-48: Segmental & Drift
    nh = len(ht)
    n3 = nh // 3
    e_m = float(np.median(ht[:n3])) if n3>0 else hm
    e_s = float(np.std(ht[:n3])) if n3>0 else hs
    m_m = float(np.median(ht[n3:2*n3])) if n3>0 else hm
    m_s = float(np.std(ht[n3:2*n3])) if n3>0 else hs
    l_m = float(np.median(ht[2*n3:])) if n3>0 else hm
    l_s = float(np.std(ht[2*n3:])) if n3>0 else hs
    
    drift = float((l_m - e_m) / (max(l_m, e_m, 1.0)))
    v_drf = float(np.var(ht[nh//2:]) / (np.var(ht[:nh//2]) + 1e-8))
    fatig = float(np.median(ht[nh//2:]) / (np.median(ht[:nh//2]) + 1e-8))
    
    # 49-51: Typing Speed (TS)
    tsm = float(np.mean(lat))
    tss = float(np.std(lat))
    tdd = float(_b(ht) - _b(lat))
    
    # 52-60: DFA & Permutation Entropy
    dfa_h = _dfa_alpha(ht)
    dfa_f = _dfa_alpha(ft)
    dfa_l = _dfa_alpha(lat)
    phh, phc = _perm_entropy_complexity(ht)
    pfh, pfc = _perm_entropy_complexity(ft)
    plh, plc = _perm_entropy_complexity(lat)
    
    # 61-75: Bigrams (15)
    bg_f = _bigram_features(key, lat)
    
    return np.array(ht_f + ft_f + lat_f + hand_f + [
        tpow, tfreq, slope, _b(ht), _b(lat), autoc, ent, vel, hfc,
        e_m, e_s, m_m, m_s, l_m, l_s, drift, v_drf, fatig,
        tsm, tss, tdd, dfa_h, dfa_f, dfa_l, phh, phc, pfh, pfc, plh, plc
    ] + bg_f)

def get_quantisation_mask(polling_hz: int) -> dict:
    if polling_hz >= 1000: return {'q_ms': 1.0, 'reliability': {}}
    q = 1000.0 / polling_hz
    rel = {
        'tremor_pow': 0.1, 'tremor_freq': 0.1, 'pentropy': 0.4, 'entropy': 0.4,
        'dfa': 0.5, 'slope': 0.7, 'kurt': 0.8, 'skew': 0.8
    }
    if polling_hz >= 500: rel = {k: v*1.5 for k, v in rel.items()}
    return {'q_ms': q, 'reliability': rel}

def motor_clean_filter(keystrokes: list) -> list:
    """
    Remove outliers and 'noisy' keystrokes that represent gaps, 
    long cognitive pauses, or glitches rather than motor behavior.
    """
    cleaned = []
    for k in keystrokes:
        ht = float(k.get('hold_time') if k.get('hold_time') is not None else 0)
        lat = float(k.get('latency') if k.get('latency') is not None else 0)
        
        # 1. Hardware logic: latencies < 2ms usually glitches
        if lat < 2.0: continue
        
        # 2. Motor logic: hold_time should be 10ms - 1000ms
        if not (10 <= ht <= 1000): continue
        
        # 3. Behavioral logic: gaps > 3sec are usually pauses
        if lat > 3000: continue
        
        # 4. Optional: exclude backspaces as they have different motor patterns
        key_id = str(k.get('keyId', '')).lower()
        if key_id in {'backspace', 'back', 'delete', 'del'}: continue
        
        cleaned.append(k)
    return cleaned

def get_keystroke_windows(keystrokes: list, 
                         window_size: int = 100, 
                         step: int = 50) -> list:
    """
    Extracts high-dimensional feature vectors per window.
    """
    n = len(keystrokes)
    vectors = []
    for start in range(0, n - window_size + 1, step):
        end = start + window_size
        win = keystrokes[start:end]
        
        # Extract base vectors for this window
        ht = [k['hold_time'] for k in win]
        ft = [k.get('flight_time', 0) or 0 for k in win]
        lat = [k.get('latency', 0) or 0 for k in win]
        keys = [k.get('keyId', '') for k in win]
        
        feat_vec = extract_features(ht, ft, lat, keys)
        vectors.append(feat_vec)
        
    return vectors

def aggregate_windows(vectors: list) -> np.ndarray:
    """
    Returns a 2D numpy array [n_windows, 75]
    """
    if not vectors: return np.empty((0, 75))
    return np.vstack(vectors)

def aggregate_session_features(X_windows: np.ndarray) -> np.ndarray:
    """
    Aggregates window-level features (75) into session-level (526).
    Stats calculated for each feature: mean, std, max, min, range, q1, q3.
    Final feature (526) is window_count.
    """
    if X_windows.size == 0:
        return np.zeros((1, 526))
    
    stats = []
    # mean
    stats.append(np.mean(X_windows, axis=0))
    # std
    stats.append(np.std(X_windows, axis=0))
    # max
    stats.append(np.max(X_windows, axis=0))
    # min
    stats.append(np.min(X_windows, axis=0))
    # range
    stats.append(np.max(X_windows, axis=0) - np.min(X_windows, axis=0))
    # q1 (25th percentile)
    stats.append(np.percentile(X_windows, 25, axis=0))
    # q3 (75th percentile)
    stats.append(np.percentile(X_windows, 75, axis=0))
    
    # hstack them
    session_vec = np.hstack(stats) # (525,)
    
    # 526th feature: window_count
    session_vec = np.append(session_vec, float(len(X_windows)))
    
    return session_vec.reshape(1, -1)

def build_feature_matrix(keystrokes: list, 
                        window_size: int = 100, 
                        step: int = 50) -> Optional[np.ndarray]:
    """
    Full pipeline to convert raw list -> aggregate feature matrix.
    Used by screening_api.py and main.py endpoints.
    """
    if len(keystrokes) < 150: return None
    
    clean_ks = motor_clean_filter(keystrokes)
    if len(clean_ks) < window_size: return None
    
    windows = get_keystroke_windows(clean_ks, window_size, step)
    if not windows: return None
    
    return aggregate_windows(windows)

def preprocess(X_raw: np.ndarray, prep_bundle: dict, keyboard_polling_hz: Optional[int] = None) -> np.ndarray:
    """
    Applies VarianceThreshold → column selection → RobustScaler.
    Keys in the pickle bundle:
      'variance_threshold' : fitted VarianceThreshold (526 → some subset)
      'selected_feat_idx'  : np.ndarray indices to pick 80 cols from VT output
      'scaler'             : fitted RobustScaler (80 features)
    Falls back gracefully if any step is absent.
    """
    X = X_raw.copy()
    
    # Step 1: RobustScaler (fitted on all 526 features originally, so MUST precede compression)
    scaler = prep_bundle.get('scaler')
    if scaler is not None:
        try:
            X = scaler.transform(X)
        except Exception as e:
            print(f"Scaler Exception: {e}")
            
    # Step 2: VarianceThreshold
    vt = prep_bundle.get('variance_threshold')
    if vt is None:
        vt = prep_bundle.get('vt')
        
    if vt is not None:
        try:
            X = vt.transform(X)
        except Exception as e:
            print(f"Variance Threshold Exception: {e}")
            
    # Step 3: Feature selection (stored as 'selected_feat_idx', fallback 'selected_idx')
    sel_idx = prep_bundle.get('selected_feat_idx')
    if sel_idx is None:
        sel_idx = prep_bundle.get('selected_idx')
        
    if sel_idx is not None:
        # sel_idx could be a numpy array, check its length/size
        try:
            if hasattr(sel_idx, 'size'):
                has_elements = sel_idx.size > 0
            else:
                has_elements = len(sel_idx) > 0
                
            if has_elements:
                X = X[:, sel_idx]
        except Exception as e:
            print(f"Feature Selection Exception: {e}")
            
    return X

TAPPY_MEDIAN_IKI = 187.0

def detect_correction_windows(keystrokes: list,
                               window_size: int = 100,
                               step: int = 50) -> list:
    """
    Returns boolean mask — True means the window contains a
    correction event (cognitive pause followed by backspace).
    These windows are excluded from feature aggregation.
    """
    ikis = [k['latency'] for k in keystrokes
            if k.get('latency') and 0 < k['latency'] < 10000]
    if not ikis:
        return []

    median_iki = float(np.median(ikis))
    pause_thresh = median_iki * 3.0

    n = len(keystrokes)
    contaminated = set()

    for i, ks in enumerate(keystrokes):
        lat = ks.get('latency') or 0
        if lat > pause_thresh:
            lookahead = keystrokes[i+1:i+6]
            has_backspace = any(
                str(k.get('keyId', '')).lower() in {'backspace', 'back', 'delete', 'del'}
                for k in lookahead
            )
            if has_backspace:
                for j in range(max(0, i-5), min(n, i+10)):
                    contaminated.add(j)

    mask = []
    for ws in range(0, n - window_size + 1, step):
        window_idx = set(range(ws, ws + window_size))
        mask.append(bool(window_idx & contaminated))

    return mask

def apply_speed_normalisation(X_raw: np.ndarray,
                               keystrokes: list,
                               feat_names_all: list) -> np.ndarray:
    """
    Normalise IKI-proportional features by the user's own typing speed
    relative to the Tappy population median.
    Prevents fast typists from being penalised for low IKI values.
    """
    ikis = [k['latency'] for k in keystrokes
            if k.get('latency') and 0 < k['latency'] < 10000]
    if len(ikis) < 20:
        return X_raw

    user_median = float(np.median(ikis))
    speed_ratio = user_median / TAPPY_MEDIAN_IKI
    speed_ratio = float(np.clip(speed_ratio, 0.5, 2.0))

    IKI_PROPORTIONAL = {
        'lat_mean', 'lat_med', 'lat_std', 'lat_p90', 'lat_max',
        'lat_p10', 'lat_cov',
        'bg1_mean', 'bg2_mean', 'bg3_mean', 'bg4_mean', 'bg5_mean',
        'early_ht_med', 'mid_ht_med', 'late_ht_med', 'ht_drift',
        'velocity', 'ts_mean', 'ts_std',
    }

    X_corrected = X_raw.copy()
    PREFIXES = ['mean_', 'std_', 'max_', 'min_', 'range_', 'q1_', 'q3_']

    for i, name in enumerate(feat_names_all):
        base = name.lower()
        for prefix in PREFIXES:
            if base.startswith(prefix):
                base = base[len(prefix):]
                break
        if base in IKI_PROPORTIONAL:
            X_corrected[0, i] *= speed_ratio

    return X_corrected

def extract_base_feature_name(name: str) -> str:
    """Removes aggregation prefixes to get the underlying feature name."""
    PREFIXES = ['mean_', 'std_', 'max_', 'min_', 'range_', 'q1_', 'q3_']
    base = name.lower()
    for prefix in PREFIXES:
        if base.startswith(prefix):
            return base[len(prefix):]
    return base

def compute_ood_score(X_raw: np.ndarray,
                      scaler,
                      feat_names_all: list) -> dict:
    """
    Uses the fitted RobustScaler's center_ and scale_ (which represent
    the Tappy training population distribution) to measure how far
    outside the training distribution this session is.
    """
    center = np.array(scaler.center_)
    scale = np.array(scaler.scale_)
    z = (X_raw[0] - center) / (scale + 1e-8)

    mad = float(np.median(np.abs(z)))
    extreme_fraction = float(np.mean(np.abs(z) > 3.0))

    if mad < 1.0 and extreme_fraction < 0.10:
        grade = 'In-Distribution'
        warning = None
    elif mad < 2.0 and extreme_fraction < 0.25:
        grade = 'Marginal'
        warning = 'Some features differ from the training population.'
    else:
        grade = 'Out-of-Distribution'
        warning = (
            f'{round(extreme_fraction*100)}% of features are far outside '
            f'the training data range. Result reliability is reduced.'
        )

    top_extreme = [
        feat_names_all[i]
        for i in np.argsort(np.abs(z))[::-1][:5]
        if i < len(feat_names_all)
    ]

    return {
        'ood_grade': grade,
        'ood_mad': round(mad, 3),
        'extreme_fraction': round(extreme_fraction, 3),
        'ood_warning': warning,
        'most_extreme_features': top_extreme,
    }

class FeatureExtractor:
    def __init__(self, prep_bundle: Optional[dict] = None): 
        self.prep_bundle = prep_bundle

    @staticmethod
    def build_user_feature_vector(keystrokes: list, window_size=100, step=50):
        # 1. Basic check
        if len(keystrokes) < 150:
            return None, 0
            
        # 2. Get windows (after motor clean)
        keystrokes_cleaned = motor_clean_filter(keystrokes)
        
        # 3. Detect correction contaminated windows
        correction_mask = detect_correction_windows(keystrokes_cleaned, window_size, step)
        
        # 4. Get base windows
        wins = get_keystroke_windows(keystrokes_cleaned)
        
        # 5. Filter windows if mask provided (get_keystroke_windows does its own spike filtering)
        # Parity with STEP 6
        if correction_mask:
            wins = [w for idx, w in enumerate(wins) if not correction_mask[idx % len(correction_mask)]]
            
        if len(wins) < 2:
            return None, 0
            
        X_windows = aggregate_windows(wins)
        X_session = aggregate_session_features(X_windows)
        return X_session, len(wins)

    def getTemporalFeatures(self, ht, ft, lat, key=None) -> np.ndarray:
        # Compatibility stub
        ks = [{'hold_time': h, 'flight_time': f, 'latency': l, 'keyId': k} for h, f, l, k in zip(ht, ft, lat, key)]
        X, _ = self.build_user_feature_vector(ks)
        return X if X is not None else np.empty((0, 75))

    def getAggregatedFeatures(self, windows) -> np.ndarray:
        return aggregate_windows(list(windows)) if len(windows) > 0 else None
