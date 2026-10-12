package dev.nexora.meetings.transcript;

// UNCOMPILED REFERENCE: scheduler that polls for transcripts. Repositories/services are yours to implement (JPA).
import dev.nexora.meetings.ai.MeetingAnalyzer;
import dev.nexora.meetings.google.MeetTranscriptClient;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
public class TranscriptJob {
    private final MeetingStore store; private final GoogleTokens tokens; private final MeetTranscriptClient meet; private final MeetingAnalyzer ai;
    public TranscriptJob(MeetingStore s, GoogleTokens t, MeetTranscriptClient m, MeetingAnalyzer a) { store = s; tokens = t; meet = m; ai = a; }

    public interface MeetingStore {
        java.util.List<String> dueMeetingIds(Instant now);                       // report_status IN (WAITING, PROCESSING-stale) AND next_attempt_at <= now
        boolean claim(String id);                                               // UPDATE … SET report_status='PROCESSING' WHERE id=? AND report_status IN ('WAITING_FOR_TRANSCRIPT') -> rows==1
        MeetingView view(String id);
        void retryLater(String id, int attempts, Instant next);
        void markUnavailable(String id, String reason); void markFailed(String id, String code);
        void saveReport(String id, String transcriptRef, MeetingAnalyzer.Analysis a);   // upsert by meeting_id, sync action items, status=COMPLETED/READY
    }
    public interface GoogleTokens { String accessToken(String ownerId); }          // decrypts refresh token, refreshes; throws on invalid_grant
    public record MeetingView(String id, String ownerId, String meetingCode, int attempts) {}

    @Scheduled(fixedDelayString = "${nexora.transcripts.poll-interval:PT2M}")
    @SchedulerLock(name = "transcriptPoll", lockAtMostFor = "PT10M")             // one instance at a time
    public void poll() { for (String id : store.dueMeetingIds(Instant.now())) process(id); }

    public void process(String id) {
        if (!store.claim(id)) return;                                           // someone else (or a previous run) owns it => idempotent
        MeetingView m = store.view(id);
        try {
            var r = meet.fetch(tokens.accessToken(m.ownerId()), m.meetingCode());
            if (r.availability() != MeetTranscriptClient.Availability.READY) {
                Instant next = RetryPolicy.nextAttempt(m.attempts() + 1, Instant.now());
                if (next == null) store.markUnavailable(id, "No transcript was generated for this meeting");
                else store.retryLater(id, m.attempts() + 1, next);              // back to WAITING_FOR_TRANSCRIPT
                return;
            }
            store.saveReport(id, r.transcriptName(), ai.analyze(TranscriptCleaner.clean(r.text())));
        } catch (MeetTranscriptClient.GoogleApiException e) {
            if (e.status == 401) store.markFailed(id, "GOOGLE_TOKEN_EXPIRED");
            else if (e.status == 403) store.markUnavailable(id, "Google permission missing for transcripts");
            else if (e.status == 404) store.markUnavailable(id, "Transcript not available");
            else store.retryLater(id, m.attempts() + 1, Instant.now().plusSeconds(300));
        } catch (MeetingAnalyzer.AiProviderException e) { store.markFailed(id, "AI_PROVIDER_ERROR"); }
        catch (RuntimeException e) { store.retryLater(id, m.attempts() + 1, Instant.now().plusSeconds(300)); }
    }
}
