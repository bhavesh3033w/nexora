package dev.nexora.meetings.transcript;

import java.time.Duration;
import java.time.Instant;

/** Bounded exponential-style backoff for transcript polling. Plain JDK. */
public final class RetryPolicy {
    private static final Duration[] STEPS = { Duration.ofMinutes(2), Duration.ofMinutes(5), Duration.ofMinutes(10), Duration.ofMinutes(20), Duration.ofMinutes(30), Duration.ofHours(1), Duration.ofHours(2), Duration.ofHours(4) };
    public static int maxAttempts() { return STEPS.length; }
    /** @return next attempt time, or null when attempts are exhausted (caller sets TRANSCRIPT_UNAVAILABLE). */
    public static Instant nextAttempt(int attemptsSoFar, Instant now) { return attemptsSoFar >= STEPS.length ? null : now.plus(STEPS[attemptsSoFar]); }
}
