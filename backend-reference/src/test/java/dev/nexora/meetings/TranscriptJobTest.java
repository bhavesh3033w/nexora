package dev.nexora.meetings;

// UNRUN JUnit 5 + Mockito skeleton showing the cases the backend must cover (see docs/MEETINGS_BACKEND.md §7).
import org.junit.jupiter.api.Test;
class TranscriptJobTest {
    @Test void losingTheClaimMeansNoWork() { /* store.claim()==false -> google/ai never called (idempotent) */ }
    @Test void missingTranscriptIsRetriedThenMarkedUnavailable() { /* NO_TRANSCRIPT x maxAttempts -> markUnavailable, never saveReport */ }
    @Test void pendingTranscriptSchedulesBackoff() { /* PENDING -> retryLater(attempts+1, now+2m) */ }
    @Test void revokedTokenStopsRetrying() { /* 401 -> markFailed(GOOGLE_TOKEN_EXPIRED) */ }
    @Test void duplicateDeliveryProducesOneReport() { /* second process() for same transcript_ref is a no-op */ }
    @Test void userCannotReadAnotherUsersMeeting() { /* MockMvc: GET /api/meetings/{otherUsersId} -> 403/404 */ }
    @Test void oauthCallbackWithBadStateIsRejected() { /* GET /integrations/google/callback?state=wrong -> error redirect, no token stored */ }
}
