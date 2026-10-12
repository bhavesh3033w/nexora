# backend-reference (Spring Boot, reference only)

Starting point for the **separate** Spring Boot backend described in `../docs/MEETINGS_BACKEND.md`. It is not a runnable project (no `pom.xml`, no application class).

| Verified here | Not verified (sandbox could not reach Maven Central) |
|---|---|
| `TokenCipher`, `TranscriptCleaner`, `RetryPolicy` are plain JDK and compile; `selfcheck/SelfCheck.java` passes 10 checks (`javac` + `java`) | Everything using Spring, Google client libraries or Jackson: `GoogleCalendarService`, `MeetTranscriptClient`, `TranscriptJob`, `OpenAiCompatibleAnalyzer`, `MeetingController`, the SQL, and the JUnit skeleton. They have **never been compiled or run** — expect small fixes. |

Missing pieces you still write: OAuth connect/callback controller (state store), `GoogleTokens` implementation, JPA entities/repositories behind `MeetingStore`/`MeetingService`, security config + CORS, `/clients`, `/integrations/google/*`.

Run the dependency-free checks:
```bash
javac -d out src/main/java/dev/nexora/meetings/security/TokenCipher.java src/main/java/dev/nexora/meetings/transcript/*.java selfcheck/SelfCheck.java && java -cp out SelfCheck
```
