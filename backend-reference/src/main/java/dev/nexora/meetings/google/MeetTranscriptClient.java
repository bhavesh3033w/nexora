package dev.nexora.meetings.google;

// UNCOMPILED REFERENCE: thin client for the Google Meet REST API v2 (meet.googleapis.com). Verify field names against current docs.
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.*;

@Component
public class MeetTranscriptClient {
    public enum Availability { NO_RECORD, NO_TRANSCRIPT, PENDING, READY }
    public record Lookup(Availability availability, String transcriptName, String text) {}
    private final RestClient http = RestClient.builder().baseUrl("https://meet.googleapis.com/v2").build();

    public Lookup fetch(String accessToken, String meetingCode) {
        // 1) conference record for this meeting code
        JsonNode recs = get(accessToken, "/conferenceRecords?filter=space.meeting_code%3D%22" + meetingCode + "%22");
        if (recs == null || !recs.has("conferenceRecords") || recs.get("conferenceRecords").isEmpty()) return new Lookup(Availability.NO_RECORD, null, null);
        // A meeting code can have several records (re-used link). Take the latest ended one in real code.
        String record = recs.get("conferenceRecords").get(0).get("name").asText();
        // 2) transcripts for that record
        JsonNode ts = get(accessToken, "/" + record + "/transcripts");
        if (ts == null || !ts.has("transcripts") || ts.get("transcripts").isEmpty()) return new Lookup(Availability.NO_TRANSCRIPT, null, null);
        JsonNode t = ts.get("transcripts").get(0); String name = t.get("name").asText();
        if (!"FILE_GENERATED".equals(t.path("state").asText())) return new Lookup(Availability.PENDING, name, null);
        // 3) entries (paginated). Text is never logged.
        StringBuilder sb = new StringBuilder(); String page = null;
        do {
            JsonNode es = get(accessToken, "/" + name + "/entries?pageSize=100" + (page != null ? "&pageToken=" + page : ""));
            for (JsonNode e : es.path("transcriptEntries")) sb.append(e.path("text").asText()).append('\n');
            page = es.hasNonNull("nextPageToken") ? es.get("nextPageToken").asText() : null;
        } while (page != null);
        return new Lookup(Availability.READY, name, sb.toString());
    }
    private JsonNode get(String token, String path) {
        return http.get().uri(path).headers(h -> h.setBearerAuth(token)).retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, (rq, rs) -> { throw new GoogleApiException(rs.getStatusCode().value()); }) // 401 -> TOKEN_EXPIRED, 403 -> PERMISSION_MISSING, 404 -> not available
            .body(JsonNode.class);
    }
    public static class GoogleApiException extends RuntimeException { public final int status; public GoogleApiException(int s) { super("google status " + s); status = s; } }
}
