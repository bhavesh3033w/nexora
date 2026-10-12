package dev.nexora.meetings.security;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

/** AES-256-GCM encryption for Google refresh tokens. Key = base64(32 bytes) from NEXORA_TOKEN_KEY. Plain JDK, no Spring. */
public final class TokenCipher {
    private static final int IV_BYTES = 12, TAG_BITS = 128;
    private final SecretKeySpec key; private final SecureRandom rnd = new SecureRandom();

    public TokenCipher(String base64Key) {
        byte[] k = Base64.getDecoder().decode(base64Key);
        if (k.length != 32) throw new IllegalArgumentException("NEXORA_TOKEN_KEY must be base64 of exactly 32 bytes");
        this.key = new SecretKeySpec(k, "AES");
    }
    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_BYTES]; rnd.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (Exception e) { throw new IllegalStateException("encryption failed"); } // never include token material in messages
    }
    public String decrypt(String stored) {
        try {
            if (!stored.startsWith("v1:")) throw new IllegalArgumentException("unknown format");
            ByteBuffer b = ByteBuffer.wrap(Base64.getDecoder().decode(stored.substring(3)));
            byte[] iv = new byte[IV_BYTES]; b.get(iv); byte[] ct = new byte[b.remaining()]; b.get(ct);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return new String(c.doFinal(ct), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) { throw new IllegalStateException("decryption failed"); }
    }
}
