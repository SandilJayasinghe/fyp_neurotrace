/**
 * useSessionHistory — Multi-session confirmation logic
 * 
 * Stores the last N screening results in localStorage.
 * Returns a confirmation verdict only when 2 out of 3 consecutive
 * sessions score above the threshold — reducing single-session false positives.
 */

const STORAGE_KEY = 'neurotrace_session_history';
const MAX_SESSIONS = 3;
const CONFIRMATION_THRESHOLD = 2; // Out of MAX_SESSIONS

export function getSessionHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

export function addSessionResult(result) {
    const history = getSessionHistory();
    const entry = {
        timestamp: Date.now(),
        probability: result.probability,
        label: result.label,
        label_text: result.label_text,
        threshold_used: result.threshold_used,
        confidence_band: result.confidence_band,
        session_quality_grade: result.session_quality?.grade,
        n_keystrokes: result.n_keystrokes,
    };
    const updated = [...history, entry].slice(-MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

export function clearSessionHistory() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns a summary object describing the multi-session verdict.
 * 
 * confirmationStatus:
 *   'confirmed'    — 2+ of last 3 sessions above threshold
 *   'borderline'   — 1 of last 3 sessions above threshold
 *   'cleared'      — 0 of last 3 sessions above threshold
 *   'insufficient' — fewer than 2 sessions recorded
 */
export function getMultiSessionVerdict(sessionHistory, threshold = 0.65) {
    if (!sessionHistory || sessionHistory.length < 2) {
        return {
            confirmationStatus: 'insufficient',
            sessionsAbove: sessionHistory?.length > 0
                ? sessionHistory.filter(s => s.probability >= threshold).length
                : 0,
            totalSessions: sessionHistory?.length || 0,
            message: `Complete ${MAX_SESSIONS - (sessionHistory?.length || 0)} more session(s) to establish a reliable baseline.`,
            showRetest: true,
        };
    }

    const recent = sessionHistory.slice(-MAX_SESSIONS);
    const sessionsAbove = recent.filter(s => s.probability >= threshold).length;
    const totalSessions = recent.length;

    if (sessionsAbove >= CONFIRMATION_THRESHOLD) {
        return {
            confirmationStatus: 'confirmed',
            sessionsAbove,
            totalSessions,
            message: `${sessionsAbove} of your last ${totalSessions} sessions show elevated signals. This pattern is more likely to be meaningful. Please consult a neurologist.`,
            showRetest: false,
        };
    } else if (sessionsAbove === 1) {
        return {
            confirmationStatus: 'borderline',
            sessionsAbove,
            totalSessions,
            message: `Only 1 of your last ${totalSessions} sessions showed an elevated signal. This is likely within normal variation. One more clean session is recommended.`,
            showRetest: true,
        };
    } else {
        return {
            confirmationStatus: 'cleared',
            sessionsAbove,
            totalSessions,
            message: `${totalSessions} consecutive sessions show low or normal signals. The initial elevated result appears to have been a transient anomaly.`,
            showRetest: false,
        };
    }
}
