package dev.nexora.meetings.transcript;

import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Validation + normalisation for uploaded/pasted transcripts. Plain JDK. */
public final class TranscriptCleaner {
    public static final int MAX_CHARS = 200_000; public static final long MAX_BYTES = 1_000_000;
    private static final Set<String> EXT = Set.of("txt", "vtt", "srt", "md");
    private static final Pattern NOISE = Pattern.compile("^\\s*(WEBVTT.*|NOTE.*|\\d+|\\d{1,2}:\\d{2}(:\\d{2})?[.,]\\d{3}\\s*-->.*)\\s*$");

    public static void validateUpload(String filename, byte[] data) {
        String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        if (!EXT.contains(ext)) throw new IllegalArgumentException("UNSUPPORTED_FILE_TYPE");
        if (data.length > MAX_BYTES) throw new IllegalArgumentException("TRANSCRIPT_TOO_LARGE");
    }
    /** Strict UTF-8 decode (rejects binary files renamed to .txt). */
    public static String decodeStrict(byte[] data) {
        try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString(); }
        catch (CharacterCodingException e) { throw new IllegalArgumentException("UNSUPPORTED_FILE_TYPE"); }
    }
    public static String clean(String raw) {
        StringBuilder sb = new StringBuilder();
        for (String line : raw.replace("\r", "").split("\n")) { if (NOISE.matcher(line).matches()) continue; String t = line.strip(); if (!t.isEmpty()) sb.append(t).append('\n'); }
        String out = sb.toString().strip();
        if (out.length() > MAX_CHARS) throw new IllegalArgumentException("TRANSCRIPT_TOO_LARGE");
        return out;
    }
}
