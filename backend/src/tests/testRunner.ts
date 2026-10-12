/**
 * Nexora Backend Automated Test Suite
 * Validates authentication cryptography, JWT tokens, transcripts, models, HTTP routes,
 * and the Deterministic Intent-to-Interface Adaptation Engine.
 */
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { TranscriptService } from '../services/transcriptService.js';
import { AiAnalyzerService } from '../services/aiAnalyzerService.js';
import { createServer } from '../server.js';
import { User } from '../models/User.js';
import { Meeting } from '../models/Meeting.js';
import { Project } from '../models/Project.js';
import { classifyIntentDeterministically } from '../controllers/adaptationController.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, durationMs: Date.now() - start });
    console.error(`  ✗ ${name} FAILED:`, err.message);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runAllTests(): Promise<boolean> {
  console.log('\n========================================');
  console.log(' RUNNING NEXORA BACKEND TEST SUITE');
  console.log('========================================\n');

  // Group 1: Password Hashing Cryptography
  console.log('[Suite 1: Password Cryptography & Hashing]');
  await test('bcrypt hashes passwords with high entropy', async () => {
    const raw = 'SuperSecurePass123!';
    const hash = await hashPassword(raw);
    assert(hash.startsWith('$2'), 'Hash must start with bcrypt prefix $2');
    assert(hash.length >= 60, 'Hash must be at least 60 characters');
    assert(hash !== raw, 'Hash must not equal plaintext');
  });

  await test('bcrypt verifies matching password correctly', async () => {
    const raw = 'EnterpriseGradePassword99';
    const hash = await hashPassword(raw);
    const matches = await comparePassword(raw, hash);
    assert(matches === true, 'Matching password must return true');
  });

  await test('bcrypt rejects incorrect password', async () => {
    const raw = 'RealPassword123';
    const wrong = 'WrongPassword456';
    const hash = await hashPassword(raw);
    const matches = await comparePassword(wrong, hash);
    assert(matches === false, 'Incorrect password must return false');
  });

  // Group 2: JWT Authentication Tokens
  console.log('\n[Suite 2: JWT Token Lifecycle]');
  await test('signs and validates JWT with user payload', () => {
    const payload = { userId: 'user-mongo-id-12345', email: 'test@nexora.io', role: 'admin' };
    const token = signToken(payload, '1h');
    assert(typeof token === 'string' && token.split('.').length === 3, 'JWT must have 3 segments');

    const decoded = verifyToken(token);
    assert(decoded.userId === payload.userId, 'Decoded userId must match');
    assert(decoded.email === payload.email, 'Decoded email must match');
    assert(decoded.role === payload.role, 'Decoded role must match');
  });

  await test('rejects tampered JWT signature', () => {
    const payload = { userId: '123', email: 'tamper@test.com', role: 'user' };
    const token = signToken(payload, '1h');
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.corrupted_signature_xyz`;
    let threw = false;
    try {
      verifyToken(tampered);
    } catch {
      threw = true;
    }
    assert(threw, 'Tampered token must throw verification error');
  });

  // Group 3: Meeting Transcript Cleaning & Parsing
  console.log('\n[Suite 3: Meeting Transcript Processing]');
  await test('cleans filler words from raw transcripts', () => {
    const raw = 'We um need to uh sort of deploy the new backend service.';
    const cleaned = TranscriptService.cleanText(raw);
    assert(!cleaned.includes('um') && !cleaned.includes('uh'), 'Filler words should be removed');
    assert(cleaned.includes('deploy the new backend service'), 'Core message must be preserved');
  });

  await test('parses speaker blocks and computes talk-time distribution', () => {
    const rawTranscript = `
Alice [00:05]: Welcome everyone. Today we are launching the new Nexora workspace architecture.
Bob [00:15]: The MERN backend models and security middleware are prepared and passing tests.
Alice [00:30]: Excellent. Let's make sure the action items are assigned.
    `;
    const result = TranscriptService.parseRawTranscript(rawTranscript);
    assert(result.entries.length === 3, `Expected 3 transcript entries, got ${result.entries.length}`);
    assert(result.speakers.includes('Alice') && result.speakers.includes('Bob'), 'Should detect both speakers');
    assert(result.talkTimeDistribution.length === 2, 'Should compute distribution for 2 speakers');
  });

  await test('extracts candidate action items from meeting transcript', () => {
    const entries = [
      { speaker: 'Dev Lead', text: 'I will deploy the MongoDB Atlas cluster and configure the replica set.' },
      { speaker: 'Engineer', text: 'We will review the JWT authentication middleware before release.' },
    ];
    const actions = TranscriptService.extractActionItemsHeuristic(entries);
    assert(actions.length >= 1, 'Should extract at least one action item');
    assert(actions[0].status === 'open', 'Action items should default to open status');
  });

  // Group 4: AI Insights Analyzer
  console.log('\n[Suite 4: AI Insights Analyzer Engine]');
  await test('generates structured insights from transcript entries', async () => {
    const entries = [
      { speaker: 'Sarah', text: 'Great progress this week! The project is on track and performance is high.' },
      { speaker: 'Alex', text: 'I agree. The backend API is reliable and response times are under 50ms.' },
    ];
    const insights = await AiAnalyzerService.analyzeMeeting('Sprint Review', entries);
    assert(typeof insights.summary === 'string' && insights.summary.length > 10, 'Summary must be non-empty string');
    assert(Array.isArray(insights.keyTakeaways) && insights.keyTakeaways.length > 0, 'Must have key takeaways');
    assert(insights.sentiment.overall === 'positive', 'Positive sentiment should be detected');
    assert(insights.sentiment.score > 0.5, 'Positive sentiment score should be > 0.5');
    assert(Array.isArray(insights.topics) && insights.topics.length > 0, 'Must extract topics');
  });

  // Group 5: HTTP Server & Routing
  console.log('\n[Suite 5: Express HTTP App & Route Configuration]');
  await test('creates Express application instance with middleware', () => {
    const app = createServer();
    assert(typeof app.listen === 'function', 'Express instance must have listen method');
  });

  // Group 6: Mongoose Model Schema Validation
  console.log('\n[Suite 6: Mongoose Model Schema Validations]');
  await test('validates User model required fields', () => {
    const user = new User({});
    const error = user.validateSync();
    assert(error !== undefined, 'User without fields must fail validation');
    assert(error?.errors['email'] !== undefined, 'Email must be required');
    assert(error?.errors['name'] !== undefined, 'Name must be required');
  });

  await test('validates Meeting model schema constraints', () => {
    const meeting = new Meeting({ title: 'Design Review', host: '64a123456789abcdef123456' as any });
    const error = meeting.validateSync();
    assert(!error || !error.errors['host'], 'Host should be valid ObjectId');
  });

  await test('validates Project model schema defaults and constraints', () => {
    const project = new Project({ title: 'Core API' });
    assert(project.status === 'planning', 'Project status should default to planning');
    assert(project.progressPercentage === 0, 'Progress percentage should default to 0');
  });

  // Group 7: Deterministic Intent-to-Interface Adaptation Engine
  console.log('\n[Suite 7: Deterministic Adaptation & Intent Classification]');
  await test('classifies meeting preparation intent accurately', () => {
    const res = classifyIntentDeterministically("Prepare me for tomorrow's client meeting with Acme Corp.");
    assert(res.rule.intent === 'meeting', `Expected intent meeting, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'meetings', 'Workspace should be meetings');
    assert(res.rule.focus.includes('agenda'), 'Focus should include agenda');
    assert(res.rule.focus.includes('clientContext'), 'Focus should include clientContext');
  });

  await test('classifies examination preparation intent accurately', () => {
    const res = classifyIntentDeterministically("Help me prepare for my upcoming exam in Operating Systems.");
    assert(res.rule.intent === 'study', `Expected intent study, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'study', 'Workspace should be study');
    assert(res.rule.focus.includes('revisionTopics'), 'Focus should include revisionTopics');
    assert(res.rule.order.includes('learning'), 'Order should include learning widget');
  });

  await test('classifies overdue project tasks and blockers intent accurately', () => {
    const res = classifyIntentDeterministically("Show me overdue project tasks, deadlines and blockers.");
    assert(res.rule.intent === 'project', `Expected intent project, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'projects', 'Workspace should be projects');
    assert(res.rule.focus.includes('overdue'), 'Focus should include overdue');
    assert(res.rule.focus.includes('blockers'), 'Focus should include blockers');
  });

  await test('classifies analytics investigation intent accurately', () => {
    const res = classifyIntentDeterministically("Investigate why active users have declined this week.");
    assert(res.rule.intent === 'analytics', `Expected intent analytics, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'analytics', 'Workspace should be analytics');
    assert(res.rule.focus.includes('activityChart'), 'Focus should include activityChart');
  });

  await test('classifies unread communications intent accurately', () => {
    const res = classifyIntentDeterministically("Summarize my unread messages and help me draft replies.");
    assert(res.rule.intent === 'communication', `Expected intent communication, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'communication', 'Workspace should be communication');
    assert(res.rule.focus.includes('unread'), 'Focus should include unread');
  });

  await test('falls back cleanly to general assistance for unclassified intents', () => {
    const res = classifyIntentDeterministically("Hello, how are you today?");
    assert(res.rule.intent === 'general', `Expected intent general, got ${res.rule.intent}`);
    assert(res.rule.workspace.id === 'assistant', 'Workspace should be assistant');
  });

  // Group 8: Keyword Normalization & Weighted Scoring
  console.log('\n[Suite 8: Keyword Normalization & Scoring]');
  await test('handles punctuation, multiple spaces, and mixed case', () => {
    const res = classifyIntentDeterministically("  PREPARE... for tomorrow's   CLIENT MEETING!?? ");
    assert(res.rule.intent === 'meeting', 'Should classify despite punctuation and casing');
    assert(res.score > 2, 'Score should reflect weighted matches');
  });

  await test('widget registry and focus components are safe approved identifiers', () => {
    const res = classifyIntentDeterministically("Show project tasks");
    const approvedWidgets = ['tasks', 'meetings', 'messages', 'notifications', 'learning', 'projects', 'analytics', 'assistant'];
    for (const widgetId of res.rule.order) {
      assert(approvedWidgets.includes(widgetId), `Widget ${widgetId} must be in approved registry`);
    }
  });

  // Summary
  console.log('\n========================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(` TEST SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  return failed === 0;
}

// Execute tests if run directly
runAllTests().then((allPassed) => {
  if (!allPassed) {
    process.exit(1);
  }
});
