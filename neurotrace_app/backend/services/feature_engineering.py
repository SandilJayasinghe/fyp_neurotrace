import numpy as np
import math
from typing import List, Optional, Dict, Any

# --- Notebook Verbatim Functions (Step 4 Requirement) ---

def _stats(x):
    m = x.mean(); s = x.std()
    if s < 1e-10: return m, 0., 0., 0., 0.
    z = (x - m) / s
    return m, s, float((z**3).mean()), float((z**4).mean() - 3.), s / (m + 1e-8)

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
        tm = t.mean(); t2 = ((t-tm)**2).sum()
        slope_v = ((seg - seg.mean(1, keepdims=True)) * (t - tm)).sum(1) / t2
        trend = slope_v[:, None] * (t - tm) + seg.mean(1, keepdims=True)
        flucts.append(np.sqrt(((seg - trend)**2).mean()))
    if len(flucts) < 3: return 0.75
    log_f = np.array(flucts); log_f = np.where(log_f <= 0, 1e-10, log_f)
    try:
        alpha = np.polyfit(np.log10(box_sizes[:len(flucts)]), np.log10(log_f), 1)[0]
    except: return 0.75
    return float(np.clip(alpha, 0., 2.))

def _perm_entropy_complexity(x, order=3):
    n = len(x); n_patterns = math.factorial(order)
    if n < order + 1: return 0.5, 0.0
    x = np.ascontiguousarray(x, dtype=np.float64)
    shape = (n - order + 1, order)
    wins = np.lib.stride_tricks.as_strided(x, shape=shape, strides=(x.strides[0], x.strides[0])).copy()
    ranks = np.argsort(wins, axis=1)
    powers = np.array([order**i for i in range(order-1, -1, -1)])
    idx = (ranks * powers).sum(axis=1) % n_patterns
    counts = np.bincount(idx, minlength=n_patterns).astype(np.float64)
    p = counts / counts.sum(); p_nz = p[p > 0]
    H = float(np.clip(-np.sum(p_nz * np.log2(p_nz)) / np.log2(n_patterns), 0., 1.))
    def _sh(q): q2 = q[q > 0]; return -np.sum(q2 * np.log2(q2))
    p_u = np.ones(n_patterns) / n_patterns; m = (p + p_u) / 2.
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
    ht = np.ascontiguousarray(ht, dtype=np.float64); ft = np.ascontiguousarray(ft, dtype=np.float64); lat = np.ascontiguousarray(lat, dtype=np.float64)
    hm, hs, hsk, hku, hcv = _stats(ht)
    ht_f = [hm, float(np.median(ht)), hs, float(np.percentile(ht, 75) - np.percentile(ht, 25)), float(ht.max()), float(np.percentile(ht, 10)), float(np.percentile(ht, 90)), hsk, hku, hcv]
    fm, fs, fsk, _, fcv = _stats(ft)
    ft_f = [fm, float(np.median(ft)), fs, float(np.percentile(ft, 75) - np.percentile(ft, 25)), float(ft.max()), float(np.percentile(ft, 90)), fsk, fcv]
    lm, ls, lsk, _, lcv = _stats(lat)
    lat_f = [lm, float(np.median(lat)), ls, float(np.percentile(lat, 90)), float(lat.max()), float(np.percentile(lat, 10)), lsk, lcv]
    
    if key is not None:
        _LEFT_CHARS = set('`12345qwertasdfgzxcvbQWERTASDFGZXCVB')
        _RIGHT_CHARS = set("67890-=yuiophjklnmYUIOPHJKLNM[];'\\,./")
        def _to_h(k):
            if k == 'L': return 0
            if k == 'R': return 1
            ks = str(k)[:1] if k else ''
            if ks in _LEFT_CHARS: return 0
            if ks in _RIGHT_CHARS: return 1
            return 2
        h = np.array([_to_h(k) for k in key], dtype=np.int8)
        med_l = float(np.median(lat))
        hand_f = [float(np.median(lat[1:][(h[:-1] == a) & (h[1:] == b)])) if ((h[:-1] == a) & (h[1:] == b)).any() else med_l for a, b in [(0, 0), (0, 1), (1, 0), (1, 1)]]
    else: hand_f = [float(np.median(lat))] * 4

    tpow = tfreq = 0.
    if len(ht) >= 32:
        try:
            from scipy.fft import fft, fftfreq
            yf = fft(ht - ht.mean()); n = len(ht)
            xf = fftfreq(n, 1/125.0); idx = (xf > 0) & (xf < 12.0)
            if idx.any():
                pxx = np.abs(yf[idx])**2
                tpow = float(pxx.max()); tfreq = float(xf[idx][np.argmax(pxx)])
        except: pass
    
    slope = float(np.polyfit(np.arange(len(ht)), ht, 1)[0]) if len(ht) >= 10 else 0.0
    
    def _bursts(x):
        if len(x) < 5: return 0.0
        m = x.mean(); s = x.std()
        return float((x > (m + 1.5*s)).sum() / len(x))
    
    autoc = float(np.corrcoef(ht[:-1], ht[1:])[0, 1]) if len(ht) >= 10 else 0.0
    ht_ft_corr = float(np.corrcoef(ht, ft)[0, 1]) if len(ht) >= 10 else 0.0
    
    nh = len(ht); nh3 = nh // 3
    early = float(np.median(ht[:nh3])) if nh3 > 0 else hm
    mid = float(np.median(ht[nh3:2*nh3])) if nh3 > 0 else hm
    late = float(np.median(ht[2*nh3:])) if nh3 > 0 else hm
    
    dfa_ht = _dfa_alpha(ht); dfa_ft = _dfa_alpha(ft); dfa_lat = _dfa_alpha(lat)
    pent_ht_H, pent_ht_C = _perm_entropy_complexity(ht)
    pent_ft_H, pent_ft_C = _perm_entropy_complexity(ft)
    pent_lat_H, pent_lat_C = _perm_entropy_complexity(lat)
    
    bigrams = _bigram_features(key, lat)
    
    return np.array(ht_f + ft_f + lat_f + hand_f + [
        tpow, tfreq, slope, _bursts(ht), _bursts(lat), autoc, pent_ht_H, 
        float(np.sqrt((np.diff(ht)**2).mean())), ht_ft_corr, early, 
        float(ht[:nh3].std() if nh3 > 0 else hs), mid, 
        float(ht[nh3:2*nh3].std() if nh3 > 0 else hs), late, 
        float(ht[2*nh3:].std() if nh3 > 0 else hs), 
        float((late - early) / (max(late, early, 1.0))), 
        float(np.var(ht[nh//2:]) / (np.var(ht[:nh//2]) + 1e-8)), 
        float(np.median(ht[nh//2:]) / (np.median(ht[:nh//2]) + 1e-8)), 
        float(lat.mean()), float(lat.std()), float((_bursts(ht) - _bursts(lat))), 
        dfa_ht, dfa_ft, dfa_lat, pent_ht_H, pent_ht_C, pent_ft_H, pent_ft_C, 
        pent_lat_H, pent_lat_C] + bigrams, dtype=np.float64)

def get_quantisation_mask(polling_hz: int) -> dict:
    if polling_hz >= 1000: return {'q_ms': 1.0, 'reliability': {}}
    q = 1000.0 / polling_hz
    rel = {
        'tremor_pow': 0.1, 'tremor_freq': 0.1, 'pentropy': 0.4, 'entropy': 0.4,
        'dfa': 0.5, 'slope': 0.7, 'kurt': 0.8, 'skew': 0.8
    }
    if polling_hz >= 500: rel = {k: v*1.5 for k, v in rel.items()}
    return {'q_ms': q, 'reliability': rel}

def extract_base_feature_name(name: str) -> str:
    parts = name.split('_')
    if parts[0] in ['mean', 'std', 'max', 'min', 'range', 'q1', 'q3']:
        return '_'.join(parts[1:])
    return name

def motor_clean_filter(keystrokes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    CORRECTION_KEYS = {'backspace', 'back', 'delete', 'del'}
    PRE_BURST_WINDOW_MS = 500
    n = len(keystrokes)
    if n == 0: return keystrokes
    bs_indices = set()
    for i, k in enumerate(keystrokes):
        key_name = str(k.get('keyId', '')).lower()
        if key_name in CORRECTION_KEYS: bs_indices.add(i)
    corrected = set(); correction_count = 0
    for i in range(n - 1, -1, -1):
        if i in bs_indices: correction_count += 1
        elif correction_count > 0: corrected.add(i); correction_count -= 1
    in_burst_zone = set(); i = 0
    while i < n:
        if i in bs_indices:
            burst_start = i; ms_back = 0; j = burst_start - 1
            while j >= 0 and j not in bs_indices:
                iki = keystrokes[j + 1].get('latency') or 0
                ms_back += iki
                if ms_back > PRE_BURST_WINDOW_MS: break
                in_burst_zone.add(j); j -= 1
            while i < n and i in bs_indices: i += 1
        else: i += 1
    excluded = bs_indices | corrected | in_burst_zone
    survivors = [k for idx, k in enumerate(keystrokes) if idx not in excluded]
    if len(survivors) < 2: return survivors
    original_indices = [idx for idx in range(n) if idx not in excluded]
    result = []
    for si, orig_idx in enumerate(original_indices):
        ks = dict(survivors[si])
        if si == 0: ks['latency'] = None
        else:
            prev_orig_idx = original_indices[si - 1]
            if orig_idx != prev_orig_idx + 1: ks['latency'] = None
        result.append(ks)
    return result

def get_keystroke_windows(keystrokes: List[Dict[str, Any]], polling_hz: int = 125) -> List[np.ndarray]:
    WINDOW, STEP = 100, 50
    keystrokes = motor_clean_filter(keystrokes)
    n = len(keystrokes)
    if n < 150: return []
    all_il = [k['latency'] for k in keystrokes if k.get('latency') and 0 < k['latency'] < 10000]
    if len(all_il) < 20: return []
    mask = get_quantisation_mask(polling_hz); q_ms = mask['q_ms']
    median_iki = float(np.median(all_il))
    spike_thresh = max(median_iki * 6.0, q_ms * 3)
    wins = []; spike_threshold_ratio = 0.20 if polling_hz < 500 else 0.12
    for ws in range(0, n - WINDOW + 1, STEP):
        window_ks = keystrokes[ws:ws+WINDOW]
        window_il = [k['latency'] for k in window_ks if k.get('latency') and k['latency'] > 0]
        spike_count = sum(1 for il in window_il if il > spike_thresh)
        if (spike_count / max(len(window_il), 1)) > spike_threshold_ratio: continue
        ht = np.array([k['hold_time'] for k in window_ks])
        ft = np.array([min(k.get('flight_time', 0) or 0, 2000.0) for k in window_ks])
        lt = np.array([k.get('latency', 0) or 0 for k in window_ks])
        k_list = [ks.get('keyId', '') for ks in window_ks]
        f = extract_features(ht, ft, lt, k_list)
        if np.isfinite(f).all(): wins.append(f)
    return wins

def aggregate_windows(wins: List[np.ndarray]) -> Optional[np.ndarray]:
    if not wins: return None
    arr = np.array(wins, dtype=np.float32)
    def trimmed_median(data, axis=0):
        if data.shape[0] < 5: return np.median(data, axis=axis)
        low, high = np.percentile(data, [15, 85], axis=axis)
        mask = (data >= low) & (data <= high)
        return np.array([np.median(data[mask[:, i], i]) if mask[:, i].any() else np.median(data[:, i]) for i in range(data.shape[1])])
    agg_medians = trimmed_median(arr, axis=0)
    user_f = np.concatenate([agg_medians, arr.std(0), arr.max(0), arr.min(0), arr.max(0) - arr.min(0), np.percentile(arr, 25, axis=0), np.percentile(arr, 75, axis=0), [arr.shape[0]]])
    return user_f.reshape(1, -1)

def build_feature_matrix(keystrokes: List[Dict[str, Any]], polling_hz: int = 125) -> Optional[np.ndarray]:
    wins = get_keystroke_windows(keystrokes, polling_hz)
    return aggregate_windows(wins)

def preprocess(X_raw: np.ndarray, prep_bundle: dict, polling_hz: int = 125) -> np.ndarray:
    X = prep_bundle['scaler'].transform(X_raw)
    if prep_bundle.get('variance_threshold'): X = prep_bundle['variance_threshold'].transform(X)
    idx = [prep_bundle['feat_names_sel'].index(n) for n in prep_bundle['feat_names_sel']] # simplified for parity
    X_out = X[:, idx].copy(); mask = get_quantisation_mask(polling_hz)
    for i, name in enumerate(prep_bundle['feat_names_sel']):
        bname = extract_base_feature_name(name)
        rel = mask['reliability'].get(bname, 1.0)
        if rel < 1.0: X_out[0, i] *= rel
    return X_out

def apply_speed_normalisation(keystroke_dicts: list, X_raw: np.ndarray, feat_names: list) -> np.ndarray:
    ikis = [k['latency'] for k in keystroke_dicts if k.get('latency') and 0 < k['latency'] < 10000]
    if len(ikis) < 20: return X_raw
    speed_ratio = np.median(ikis) / 187.0
    IKI_PROPORTIONAL_FEATURES = {'lat_mean','lat_med','lat_std','lat_p90','bg1_mean','bg2_mean','bg3_mean','bg4_mean','bg5_mean','early_ht_med','mid_ht_med','late_ht_med','velocity'}
    X_corrected = X_raw.copy()
    for i, name in enumerate(feat_names):
        base = name.split('_', 1)[1] if '_' in name else name
        if base in IKI_PROPORTIONAL_FEATURES: X_corrected[0, i] *= speed_ratio
    return X_corrected

def get_bigram_alignment_score(keystroke_dicts: list) -> float:
    if len(keystroke_dicts) < 2: return 0.5
    _LEFT_CHARS = set('`12345qwertasdfgzxcvbQWERTASDFGZXCVB')
    def get_hand(k): return 'L' if str(k.get('keyId', ''))[:1] in _LEFT_CHARS else 'R'
    hand_stream = [get_hand(k) for k in keystroke_dicts]
    from collections import Counter
    counts = Counter([hand_stream[i]+hand_stream[i+1] for i in range(len(hand_stream)-1)])
    return float((counts.get('LR', 0) + counts.get('RL', 0)) / max(sum(counts.values()), 1))

class FeatureExtractor:
    def __init__(self, prep_bundle: Optional[dict] = None): self.prep_bundle = prep_bundle
    def getTemporalFeatures(self, ht, ft, lat, key=None) -> np.ndarray:
        # For simplicity, we create dict list to use internal windowing
        ks = [{'hold_time': h, 'flight_time': f, 'latency': l, 'keyId': k} for h, f, l, k in zip(ht, ft, lat, key)]
        wins = get_keystroke_windows(ks)
        return np.array(wins) if wins else np.empty((0, 75))
    def getAggregatedFeatures(self, windows) -> np.ndarray:
        return aggregate_windows(list(windows)) if len(windows) > 0 else None
