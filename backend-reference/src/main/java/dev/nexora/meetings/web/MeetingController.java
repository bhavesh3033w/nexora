package dev.nexora.meetings.web;

// UNCOMPILED REFERENCE: route shapes + ownership enforcement. Implement MeetingService with your JPA repositories.
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController @RequestMapping("/api")
public class MeetingController {
    public interface MeetingService {
        List<Object> list(String ownerId); Object get(String ownerId, String id);        // MUST throw 404/403 when owner mismatch
        Object create(String ownerId, Map<String, Object> body); Object update(String ownerId, String id, Map<String, Object> patch);
        Object schedule(String ownerId, String id); Map<String, Object> start(String ownerId, String id); Object complete(String ownerId, String id);
        Object report(String ownerId, String id); Object processTranscript(String ownerId, String id);
        Object submitTranscript(String ownerId, String id, String text); Object setActionItem(String ownerId, String id, String itemId, boolean done);
    }
    public record UserRef(String id) {}
    private final MeetingService svc; public MeetingController(MeetingService s) { svc = s; }

    @GetMapping("/meetings") List<Object> list(@AuthenticationPrincipal UserRef u) { return svc.list(u.id()); }
    @PostMapping("/meetings") Object create(@AuthenticationPrincipal UserRef u, @RequestBody Map<String, Object> b) { return svc.create(u.id(), b); }
    @GetMapping("/meetings/{id}") Object get(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.get(u.id(), id); }
    @PatchMapping("/meetings/{id}") Object patch(@AuthenticationPrincipal UserRef u, @PathVariable String id, @RequestBody Map<String, Object> p) { return svc.update(u.id(), id, p); }
    @PostMapping("/meetings/{id}/schedule") Object schedule(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.schedule(u.id(), id); }
    @PostMapping("/meetings/{id}/start") Map<String, Object> start(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.start(u.id(), id); }
    @PostMapping("/meetings/{id}/complete") Object complete(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.complete(u.id(), id); }
    @GetMapping("/meetings/{id}/report") Object report(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.report(u.id(), id); }
    @PostMapping("/meetings/{id}/process-transcript") Object process(@AuthenticationPrincipal UserRef u, @PathVariable String id) { return svc.processTranscript(u.id(), id); }
    @PostMapping(value = "/meetings/{id}/transcript", consumes = "application/json") Object transcriptJson(@AuthenticationPrincipal UserRef u, @PathVariable String id, @RequestBody Map<String, String> b) { return svc.submitTranscript(u.id(), id, b.getOrDefault("text", "")); }
    @PostMapping(value = "/meetings/{id}/transcript", consumes = "multipart/form-data") Object transcriptFile(@AuthenticationPrincipal UserRef u, @PathVariable String id, @RequestParam("file") MultipartFile f) throws Exception {
        dev.nexora.meetings.transcript.TranscriptCleaner.validateUpload(Objects.requireNonNullElse(f.getOriginalFilename(), ""), f.getBytes());
        return svc.submitTranscript(u.id(), id, dev.nexora.meetings.transcript.TranscriptCleaner.decodeStrict(f.getBytes()));
    }
    @PatchMapping("/meetings/{id}/action-items/{itemId}") Object action(@AuthenticationPrincipal UserRef u, @PathVariable String id, @PathVariable String itemId, @RequestBody Map<String, Boolean> b) { return svc.setActionItem(u.id(), id, itemId, Boolean.TRUE.equals(b.get("done"))); }
}
