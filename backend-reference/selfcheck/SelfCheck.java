import dev.nexora.meetings.security.TokenCipher;
import dev.nexora.meetings.transcript.*;
import java.time.Instant;
import java.util.Base64;

/** Dependency-free checks (run with javac/java). Real tests live in src/test (JUnit, not run here). */
public class SelfCheck {
    static void check(boolean ok, String name) { System.out.println((ok ? "PASS " : "FAIL ") + name); if (!ok) System.exit(1); }
    static boolean throwsIAE(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException | IllegalStateException e) { return true; } }
    public static void main(String[] a) {
        byte[] k = new byte[32]; new java.security.SecureRandom().nextBytes(k);
        TokenCipher c = new TokenCipher(Base64.getEncoder().encodeToString(k));
        String e1 = c.encrypt("1//refresh-token"), e2 = c.encrypt("1//refresh-token");
        check(c.decrypt(e1).equals("1//refresh-token"), "cipher round-trip");
        check(!e1.equals(e2) && !e1.contains("refresh"), "cipher uses random IV and hides plaintext");
        check(throwsIAE(() -> c.decrypt(e1.substring(0, e1.length() - 4) + "AAAA")), "cipher rejects tampered data");
        check(throwsIAE(() -> new TokenCipher(Base64.getEncoder().encodeToString(new byte[16]))), "cipher rejects short key");
        String vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello team.\n\n2\n00:00:04.000 --> 00:00:06.000\nWe decided to ship.";
        check(TranscriptCleaner.clean(vtt).equals("Hello team.\nWe decided to ship."), "VTT cleaning");
        check(throwsIAE(() -> TranscriptCleaner.validateUpload("a.exe", new byte[1])), "reject .exe");
        check(throwsIAE(() -> TranscriptCleaner.validateUpload("a.txt", new byte[1_000_001])), "reject >1MB");
        check(throwsIAE(() -> TranscriptCleaner.decodeStrict(new byte[]{(byte) 0xC3, 0x28})), "reject invalid UTF-8");
        Instant t = Instant.parse("2026-01-01T00:00:00Z");
        check(RetryPolicy.nextAttempt(0, t).equals(t.plusSeconds(120)), "first retry in 2 min");
        check(RetryPolicy.nextAttempt(RetryPolicy.maxAttempts(), t) == null, "retries are bounded");
    }
}
