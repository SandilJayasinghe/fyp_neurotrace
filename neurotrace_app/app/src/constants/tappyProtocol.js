/**
 * Tappy Biometric Protocol v1.0
 * 
 * Replaces free-text typing with binary hand-alternation (A/L keys).
 * Matches the original Tappy dataset used for model training.
 */
export const TAPPY_PROTOCOL = {
    LEFT_KEY:  'a',           // Physical key for left hand
    RIGHT_KEY: 'l',           // Physical key for right hand
    LEFT_LABEL:  'A',         // Visual label for left panel
    RIGHT_LABEL: 'L',         // Visual label for right panel
    TARGET_KEYSTROKES: 300,   // High-precision target count
    MIN_KEYSTROKES: 150,      // Absolute minimum for inference
    WARMUP_KEYSTROKES: 20,    // Initial discards to clear motor transient
    SESSION_TIME_LIMIT: 300,  // Max 5 minutes (300 seconds)
    EXPECTED_SEQUENCE: ['L', 'R'], // Alternating hand expectation
};
