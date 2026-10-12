package dev.nexora.meetings.google;

// UNCOMPILED REFERENCE (needs google-api-services-calendar + google-auth-library-oauth2-http).
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.*;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class GoogleCalendarService {
    public record Created(String eventId, String meetUrl, String meetingCode, String htmlLink) {}
    public record Attendee(String name, String email) {}

    /** accessToken comes from GoogleTokenService (refresh token decrypted server-side, never logged). */
    public Created createMeetEvent(String accessToken, String title, String agenda, LocalDate date, LocalTime time, ZoneId zone, Duration length, List<Attendee> attendees) throws Exception {
        Calendar cal = new Calendar.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(GoogleCredentials.create(new AccessToken(accessToken, null)))).setApplicationName("Nexora").build();
        ZonedDateTime start = ZonedDateTime.of(date, time, zone);
        Event ev = new Event().setSummary(title).setDescription(agenda)
            .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(start.toInstant().toEpochMilli())).setTimeZone(zone.getId()))
            .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(start.plus(length).toInstant().toEpochMilli())).setTimeZone(zone.getId()))
            .setAttendees(attendees.stream().map(a -> new EventAttendee().setEmail(a.email()).setDisplayName(a.name())).toList())
            .setConferenceData(new ConferenceData().setCreateRequest(new CreateConferenceRequest()
                .setRequestId(UUID.randomUUID().toString())                         // idempotency key for the conference
                .setConferenceSolutionKey(new ConferenceSolutionKey().setType("hangoutsMeet"))));
        Event saved = cal.events().insert("primary", ev).setConferenceDataVersion(1).setSendUpdates("all").execute();
        // conference creation can be async: if status != "success", re-fetch the event shortly (omitted).
        String code = saved.getConferenceData() != null ? saved.getConferenceData().getConferenceId() : null;
        return new Created(saved.getId(), saved.getHangoutLink(), code, saved.getHtmlLink());
    }
}
