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
    print("[DEBUG] extract_features: ht[0:5]", ht[:5], "ft[0:5]", ft[:5], "lat[0:5]", lat[:5])
    hm, hs, hsk, hku, hcv = _stats(ht)
    ht_f = [hm, float(np.median(ht)), hs, float(np.percentile(ht, 75) - np.percentile(ht, 25)), float(ht.max()), float(np.percentile(ht, 10)), float(np.percentile(ht, 90)), hsk, hku, hcv]
    fm, fs, fsk, _, fcv = _stats(ft)
    ft_f = [fm, float(np.median(ft)), fs, float(np.percentile(ft, 75) - np.percentile(ft, 25)), float(ft.max()), float(np.percentile(ft, 90)), fsk, fcv]
    lm, ls, lsk, _, lcv = _stats(lat)
    lat_f = [lm, float(np.median(lat)), ls, float(np.percentile(lat, 90)), float(lat.max()), float(np.percentile(lat, 10)), lsk, lcv]
    print("[DEBUG] Feature stats: ht_f", ht_f, "ft_f", ft_f, "lat_f", lat_f)
    if key is not None:
        # QWERTY hand assignment: matches handMap.js exactly
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
    print("[DEBUG] Hand features:", hand_f)
    # Tremor & Slope
    tpow = tfreq = 0.
    if len(ht) >= 32:
        try:
            from scipy.fft import fft, fftfreq
            fv = np.abs(fft(lat)); fr = fftfreq(len(lat), d=max(lm, 1)/1000.)
            mk = (fr >= 4.) & (fr <= 6.)
            if mk.any(): tpow = float(fv[mk].sum()); tfreq = float(fr[mk][fv[mk].argmax()])
        except: pass
    xi = np.arange(len(ht), dtype=np.float64); xi_m = xi.mean()
    slope = float(((ht - hm) * (xi - xi_m)).sum() / ((xi - xi_m)**2).sum()) if len(ht) > 1 else 0.
    # Motor Metrics
    lat_med = float(np.median(lat))
    burst = float((lat < lat_med).sum()) / len(ht)
    ac = float(np.corrcoef(lat[:-1], lat[1:])[0, 1]) if len(lat) > 2 else 0.
    ac = 0. if not np.isfinite(ac) else ac
    lo, hi = lat.min(), lat.max()
    ent = 0.
    if hi > lo:
        hh = np.histogram(lat, bins=np.linspace(lo, hi, 11), density=True)[0] * (hi - lo) / 10
        ent = float(-((hh + 1e-8) * np.log2(hh + 1e-8)).sum())
    htft = float(np.corrcoef(ht, ft)[0, 1]) if len(ht) > 2 else 0.
    # Early/Late
    t = max(len(ht) // 3, 1)
    e, l = ht[:t], ht[-t:]
    deg = [float(e.mean()), float(e.std()), float(np.median(ht)), float(ht.std()), float(l.mean()), float(l.std()), float(l.mean() - e.mean()), float(l.std() - e.std())]
    fat = (ht[len(ht)//2:].mean() - ht[:len(ht)//2].mean()) / (ht[:len(ht)//2].mean() + 1e-8) if len(ht) > 10 else 0.
    ts = np.cumsum(lat); tsn = (ts - ts[0]) / (ts[-1] - ts[0] + 1e-8)
    ts_f = [float(tsn.mean()), float(tsn.std()), float(tsn[:len(tsn)//2].mean() - tsn[len(tsn)//2:].mean())]
    # Biomarkers
    dfa = [_dfa_alpha(ht), _dfa_alpha(ft), _dfa_alpha(lat)]
    p_ht_h, p_ht_c = _perm_entropy_complexity(ht)
    p_ft_h, p_ft_c = _perm_entropy_complexity(ft)
    p_lt_h, p_lt_c = _perm_entropy_complexity(lat)
    pent = [p_ht_h, p_ht_c, p_ft_h, p_ft_c, p_lt_h, p_lt_c]
    print("[DEBUG] Biomarkers: dfa", dfa, "pent", pent)
    features = ht_f + ft_f + lat_f + hand_f + [tpow, tfreq, slope, burst, lcv, ac, ent, float(len(ht) / (lat.sum() + 1e-8)), htft] + deg + [fat] + ts_f + dfa + pent + _bigram_features(key, lat)
    print("[DEBUG] All features (first 20):", features[:20])
    return np.array(features, dtype=np.float32)

# --- Feature Aggregation & Preprocessing ---

def get_quantisation_mask(polling_hz: int) -> dict:
    q_ms = 1000.0 / float(polling_hz)
    
    always_reliable = [
        'ht_mean', 'ht_med', 'ht_std', 'ht_iqr', 'ht_max',
        'ft_mean', 'ft_med', 'ft_std',
        'lat_mean', 'lat_med', 'lat_std', 'lat_p90',
        'trans_ll', 'trans_lr', 'trans_rl', 'trans_rr',
        'slope', 'burst', 'velocity',
        'early_ht_med', 'mid_ht_med', 'late_ht_med', 'ht_drift',
        'fatigue',
        'bg1_mean', 'bg2_mean', 'bg3_mean', 'bg4_mean', 'bg5_mean',
    ]
    
    all_75_base_names = [
        "ht_mean","ht_med","ht_std","ht_iqr","ht_max","ht_p10","ht_p90","ht_skew","ht_kurt","ht_cov",
        "ft_mean","ft_med","ft_std","ft_iqr","ft_max","ft_p90","ft_skew","ft_cov",
        "lat_mean","lat_med","lat_std","lat_p90","lat_max","lat_p10","lat_skew","lat_cov",
        "trans_ll","trans_lr","trans_rl","trans_rr","tremor_pow","tremor_freq","slope","burst",
        "rhythm","autocorr","entropy","velocity","ht_ft_corr",
        "early_ht_med","early_ht_std","mid_ht_med","mid_ht_std","late_ht_med","late_ht_std",
        "ht_drift","var_drift","fatigue","ts_mean","ts_std","ts_density_diff",
        "dfa_ht","dfa_ft","dfa_lat","pent_ht_H","pent_ht_C","pent_ft_H","pent_ft_C","pent_lat_H","pent_lat_C",
        "bg1_mean","bg1_cov","bg1_range","bg2_mean","bg2_cov","bg2_range","bg3_mean","bg3_cov","bg3_range",
        "bg4_mean","bg4_cov","bg4_range","bg5_mean","bg5_cov","bg5_range"
    ]
    
    reliability = {}
    for name in all_75_base_names:
        if name in always_reliable:
            reliability[name] = 1.0
        else:
            reliability[name] = max(0.2, 1.0 - (q_ms / 8.0))
            
    return {
        'reliability': reliability,
        'q_ms': q_ms,
        'polling_hz': polling_hz,
        'is_reliable': polling_hz >= 500
    }

def extract_base_feature_name(name: str) -> str:
    parts = name.split('_')
    if parts[0] in ["mean","std","max","min","range","q1","q3"]:
        return '_'.join(parts[1:])
    return name

def motor_clean_filter(keystrokes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filter a free-text keystroke stream to remove correction noise,
    producing a signal equivalent to Tappy-protocol data.
    
    Steps:
    1. Remove all Backspace/Delete key events
    2. Mark keys that were 'corrected' — i.e., immediately followed by
       one or more backspaces within 3000ms. These represent typo keystrokes
       and their hold-time is inflated by the realisation delay.
    3. Remove all keys inside a 'correction burst' zone — any key pressed
       in the 500ms window before a backspace sequence begins (retroactive
       correction of multi-char errors).
    4. Re-compute latency between surviving consecutive keystrokes so the
       IKI chain is clean and contiguous.
    
    Returns the filtered list. Latency of the first surviving keystroke
    after a gap is set to None (just like the Tappy warmup discards).
    """
    CORRECTION_KEYS = {'backspace', 'back', 'delete', 'del'}
    PRE_BURST_WINDOW_MS = 500  # ms before a backspace burst to exclude
    
    n = len(keystrokes)
    if n == 0:
        return keystrokes
    
    # Step 1: identify correction indices (backspace positions)
    bs_indices = set()
    for i, k in enumerate(keystrokes):
        key_name = str(k.get('key', '')).lower()
        if key_name in CORRECTION_KEYS:
            bs_indices.add(i)
    
    # Step 2: identify corrected-character indices
    # A keystroke at index i is "corrected" if the next non-backspace
    # is still followed by a backspace (or if the very next event is backspace)
    corrected = set()
    
    # Walk backwards: each backspace deletes the most recent surviving stroke
    correction_count = 0
    for i in range(n - 1, -1, -1):
        if i in bs_indices:
            correction_count += 1
        else:
            if correction_count > 0:
                corrected.add(i)
                correction_count -= 1
    
    # Step 3: identify pre-burst-zone indices
    # For each contiguous block of backspaces, exclude keys pressed in the
    # PRE_BURST_WINDOW_MS before the first backspace of that block
    in_burst_zone = set()
    i = 0
    while i < n:
        if i in bs_indices:
            # Find start of this burst
            burst_start = i
            # Look backwards for keys within the time window (using latency chain)
            ms_back = 0
            j = burst_start - 1
            while j >= 0 and j not in bs_indices:
                iki = keystrokes[j + 1].get('latency') or 0
                ms_back += iki
                if ms_back > PRE_BURST_WINDOW_MS:
                    break
                in_burst_zone.add(j)
                j -= 1
            # Skip past the burst
            while i < n and i in bs_indices:
                i += 1
        else:
            i += 1
    
    # Step 4: collect surviving keystrokes
    excluded = bs_indices | corrected | in_burst_zone
    survivors = [k for idx, k in enumerate(keystrokes) if idx not in excluded]
    
    if len(survivors) < 2:
        return survivors
    
    # Step 5: recompute latency for survivor chain
    # After a gap (skipped correction zone), the IKI to the next key is
    # meaningless — set it to None so it gets excluded from IKI stats
    original_to_survivor = {
        orig_idx: surv_idx
        for surv_idx, orig_idx in enumerate(
            idx for idx in range(n) if idx not in excluded
        )
    }
    
    # Map original indices to survivor list
    original_indices = [idx for idx in range(n) if idx not in excluded]
    
    result = []
    for si, orig_idx in enumerate(original_indices):
        ks = dict(survivors[si])  # copy
        if si == 0:
            ks['latency'] = None  # first keystroke has no prior
        else:
            prev_orig_idx = original_indices[si - 1]
            # If the two consecutive survivors were NOT consecutive in the original
            # stream, their IKI is a gap (correction was in between) — discard it
            if orig_idx != prev_orig_idx + 1:
                ks['latency'] = None
            # else keep the existing latency (no corrections between them)
        result.append(ks)
    
    return result


def build_feature_matrix(keystrokes: List[Dict[str, Any]], polling_hz: int = 125) -> Optional[np.ndarray]:
    WINDOW = 100
    STEP = 50

    # Apply motor-clean filter FIRST — removes backspaces and corrected chars
    keystrokes = motor_clean_filter(keystrokes)

    n = len(keystrokes)
    if n < 150: return None

    # NEW: compute session median IKI for adaptive threshold
    all_il = [k['latency'] for k in keystrokes
              if k.get('latency') and 0 < k['latency'] < 10000]
    
    if len(all_il) < 20:
        return None
    
    mask = get_quantisation_mask(polling_hz)
    q_ms = mask['q_ms']
    
    median_iki  = float(np.median(all_il))
    spike_thresh = median_iki * 6.0
    min_spike_thresh = q_ms * 3
    spike_thresh = max(spike_thresh, min_spike_thresh)
    
    wins = []
    spike_threshold_ratio = 0.20 if polling_hz < 500 else 0.12

    for ws in range(0, n - WINDOW + 1, STEP):
        window_ks = keystrokes[ws:ws+WINDOW]
        
        # NEW: count IKI spikes in this window
        window_il = [k['latency'] for k in window_ks
                     if k.get('latency') and k['latency'] > 0]
        spike_count = sum(1 for il in window_il if il > spike_thresh)
        spike_ratio = spike_count / max(len(window_il), 1)
        
        # Reject window
        if spike_ratio > spike_threshold_ratio:
            continue
            
        ht = np.array([k['hold_time'] for k in window_ks])
        ft = np.array([k.get('flight_time', 0) or 0 for k in window_ks])
        lt = np.array([k.get('latency', 0) or 0 for k in window_ks])
        k_list = [ks['key'] for ks in window_ks]
        
        f = extract_features(ht, ft, lt, k_list)
        if np.isfinite(f).all(): wins.append(f)
        
    if not wins: return None
    
    arr = np.array(wins, dtype=np.float32)
    # Use median instead of mean for the first aggregate — more robust to outlier windows
    user_f = np.concatenate([
        np.median(arr, axis=0),
        arr.std(0),
        arr.max(0),
        arr.min(0),
        arr.max(0) - arr.min(0),
        np.percentile(arr, 25, axis=0),
        np.percentile(arr, 75, axis=0),
        [arr.shape[0]]
    ])
    
    base = ["ht_mean","ht_med","ht_std","ht_iqr","ht_max","ht_p10","ht_p90","ht_skew","ht_kurt","ht_cov","ft_mean","ft_med","ft_std","ft_iqr","ft_max","ft_p90","ft_skew","ft_cov","lat_mean","lat_med","lat_std","lat_p90","lat_max","lat_p10","lat_skew","lat_cov","trans_ll","trans_lr","trans_rl","trans_rr","tremor_pow","tremor_freq","slope","burst","rhythm","autocorr","entropy","velocity","ht_ft_corr","early_ht_med","early_ht_std","mid_ht_med","mid_ht_std","late_ht_med","late_ht_std","ht_drift","var_drift","fatigue","ts_mean","ts_std","ts_density_diff","dfa_ht","dfa_ft","dfa_lat","pent_ht_H","pent_ht_C","pent_ft_H","pent_ft_C","pent_lat_H","pent_lat_C","bg1_mean","bg1_cov","bg1_range","bg2_mean","bg2_cov","bg2_range","bg3_mean","bg3_cov","bg3_range","bg4_mean","bg4_cov","bg4_range","bg5_mean","bg5_cov","bg5_range"]
    all_names = []
    for s in ["mean","std","max","min","range","q1","q3"]: all_names += [f"{s}_{n}" for n in base]
    all_names.append("window_count")

    for i in range(user_f.shape[0] - 1): # Ignore window_count at the end
        if i < len(all_names):
            bname = extract_base_feature_name(all_names[i])
            rel = mask['reliability'].get(bname, 1.0)
            if rel < 1.0 and polling_hz < 500:
                user_f[i] *= rel
            
    return user_f.reshape(1, -1)

def preprocess(X_raw: np.ndarray, prep_bundle: dict, polling_hz: int = 125) -> np.ndarray:
    X = prep_bundle['scaler'].transform(X_raw)
    if prep_bundle.get('variance_threshold'):
        X = prep_bundle['variance_threshold'].transform(X)
    
    # Correlation Selection matching feat_names_sel
    all_names = []
    base = ["ht_mean","ht_med","ht_std","ht_iqr","ht_max","ht_p10","ht_p90","ht_skew","ht_kurt","ht_cov","ft_mean","ft_med","ft_std","ft_iqr","ft_max","ft_p90","ft_skew","ft_cov","lat_mean","lat_med","lat_std","lat_p90","lat_max","lat_p10","lat_skew","lat_cov","trans_ll","trans_lr","trans_rl","trans_rr","tremor_pow","tremor_freq","slope","burst","rhythm","autocorr","entropy","velocity","ht_ft_corr","early_ht_med","early_ht_std","mid_ht_med","mid_ht_std","late_ht_med","late_ht_std","ht_drift","var_drift","fatigue","ts_mean","ts_std","ts_density_diff","dfa_ht","dfa_ft","dfa_lat","pent_ht_H","pent_ht_C","pent_ft_H","pent_ft_C","pent_lat_H","pent_lat_C","bg1_mean","bg1_cov","bg1_range","bg2_mean","bg2_cov","bg2_range","bg3_mean","bg3_cov","bg3_range","bg4_mean","bg4_cov","bg4_range","bg5_mean","bg5_cov","bg5_range"]
    for s in ["mean","std","max","min","range","q1","q3"]: all_names += [f"{s}_{n}" for n in base]
    all_names.append("window_count")
    
    if prep_bundle.get('variance_threshold'):
        curr_names = [all_names[i] for i, s in enumerate(prep_bundle['variance_threshold'].get_support()) if s]
    else: curr_names = all_names
    
    idx = [curr_names.index(n) for n in prep_bundle['feat_names_sel']]
    
    X_out = X[:, idx].copy()
    mask = get_quantisation_mask(polling_hz)
    
    unreliable_features = set()
    for i, name in enumerate(prep_bundle['feat_names_sel']):
        bname = extract_base_feature_name(name)
        rel = mask['reliability'].get(bname, 1.0)
        if rel < 1.0:
            X_out[0, i] *= rel
            unreliable_features.add(bname)
            
    # We will let the caller know which features were downweighted
    # But since preprocess just returns np.ndarray, we handle the reliability list logging in the API endpoint based on the mask
    return X_out
