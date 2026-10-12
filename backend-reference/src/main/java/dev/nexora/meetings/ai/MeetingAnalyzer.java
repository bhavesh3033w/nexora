package dev.nexora.meetings.ai;

import java.util.List;

/** Provider-agnostic analysis port. Implementations MUST ground output in the transcript and never fabricate owners/deadlines. */
public interface MeetingAnalyzer {
    record Item(String text, String owner, String deadline) {}
    record Analysis(String summary, List<String> topics, List<String> decisions, List<Item> actionItems, List<String> risks, List<String> followUps, String engine) {}
    /** @throws AiProviderException when the provider is unconfigured, fails, or returns invalid JSON after one repair retry. */
    Analysis analyze(String transcript);
    class AiProviderException extends RuntimeException { public AiProviderException(String m) { super(m); } }
}
