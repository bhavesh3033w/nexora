import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { User } from '../src/models/User.js';
import { UserPreference } from '../src/models/UserPreference.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { Meeting } from '../src/models/Meeting.js';
import { Message } from '../src/models/Message.js';
import { Course } from '../src/models/Course.js';
import { ActivityLog } from '../src/models/ActivityLog.js';
import { hashPassword } from '../src/utils/password.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexora';

async function seed() {
  console.log('\n=============================================');
  console.log(' SEEDING NEXORA DATABASE WITH DEMO DATA');
  console.log(` Target URI: ${uri.replace(/:[^:]*@/, ':****@')}`);
  console.log('=============================================\n');

  await mongoose.connect(uri);

  try {
    // 1. Clean existing sample data
    console.log('[1/7] Cleaning existing test collections...');
    await Promise.all([
      User.deleteMany({ email: { $in: ['admin@nexora.dev', 'user@nexora.dev', 'demo@nexora.test'] } }),
      Project.deleteMany({}),
      Task.deleteMany({}),
      Meeting.deleteMany({}),
      Message.deleteMany({}),
      Course.deleteMany({}),
      ActivityLog.deleteMany({}),
    ]);

    // 2. Create Users
    console.log('[2/7] Creating demonstration users (Admin & User)...');
    const adminHash = await hashPassword('Admin@1234567');
    const userHash = await hashPassword('User@1234567');

    const admin = await User.create({
      name: 'Nexora Administrator',
      email: 'admin@nexora.dev',
      passwordHash: adminHash,
      role: 'admin',
      department: 'Executive Operations',
      onboardingCompleted: true,
      lastLoginAt: new Date(),
    });

    const user = await User.create({
      name: 'Alex Rivera',
      email: 'user@nexora.dev',
      passwordHash: userHash,
      role: 'user',
      department: 'Product Engineering',
      onboardingCompleted: true,
      lastLoginAt: new Date(),
    });

    // 3. Create User Preferences
    console.log('[3/7] Setting up 14-question personalization preferences...');
    await UserPreference.create({
      userId: user._id,
      v: 1,
      onboarded: true,
      focus: 'tasks',
      workspace: 'all',
      layout: 'balanced',
      widgets: ['tasks', 'meetings', 'messages', 'projects', 'learning', 'analytics', 'assistant'],
      order: ['tasks', 'meetings', 'messages', 'notifications', 'learning', 'projects', 'analytics', 'assistant'],
      nav: 'sidebar',
      notifications: ['inapp', 'important'],
      theme: 'dark',
      color: 'purple',
      style: 'minimal',
      textSize: 'medium',
      spacing: 'comfortable',
      motion: 'subtle',
      goal: 'organize',
      adaptive: 'ask',
      answers: {
        focus: 'tasks',
        workspace: 'all',
        layout: 'balanced',
        widgets: ['tasks', 'meetings', 'messages', 'projects', 'learning', 'analytics', 'assistant'],
        nav: 'sidebar',
        theme: 'dark',
        color: 'purple',
        style: 'minimal',
        textSize: 'medium',
        spacing: 'comfortable',
        motion: 'subtle',
        goal: 'organize',
        adaptive: 'ask',
      },
    });

    // 4. Create Projects
    console.log('[4/7] Seeding projects and milestones...');
    const p1 = await Project.create({
      name: 'Adaptive Workspace Core 2.0',
      title: 'Adaptive Workspace Core 2.0',
      description: 'Rule-based intent-to-interface engine with local zero-LLM privacy compliance.',
      category: 'Product Engineering',
      priority: 'critical',
      status: 'active',
      progressPercentage: 65,
      owner: admin._id,
      members: [user._id, admin._id],
    });

    const p2 = await Project.create({
      name: 'Q4 Enterprise Client Delivery',
      title: 'Q4 Enterprise Client Delivery',
      description: 'Executive milestone reviews, meeting agendas, and stakeholder dashboards.',
      category: 'Client Operations',
      priority: 'high',
      status: 'active',
      progressPercentage: 40,
      owner: admin._id,
      members: [user._id],
    });

    const p3 = await Project.create({
      name: 'Security, RBAC & Cloud Architecture',
      title: 'Security, RBAC & Cloud Architecture',
      description: 'JWT rotation, role-based admin gates, and MongoDB cluster replica sets.',
      category: 'Security',
      priority: 'medium',
      status: 'active',
      progressPercentage: 80,
      owner: admin._id,
      members: [admin._id],
    });

    // 5. Create Tasks (with overdue dates, blockers, and diverse priorities)
    console.log('[5/7] Seeding tasks (including overdue and blocked items)...');
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const twoDaysAgo = fmt(new Date(today.getTime() - 2 * 86400000));
    const yesterday = fmt(new Date(today.getTime() - 1 * 86400000));
    const todayStr = fmt(today);
    const tomorrow = fmt(new Date(today.getTime() + 1 * 86400000));
    const in3Days = fmt(new Date(today.getTime() + 3 * 86400000));
    const in5Days = fmt(new Date(today.getTime() + 5 * 86400000));

    await Task.create([
      {
        title: 'Resolve database indexing bottleneck on metric telemetry',
        description: 'Ensure compound indexes are active on userId and eventType timestamps.',
        projectId: p1._id.toString(),
        project: p1._id,
        status: 'todo',
        priority: 'high',
        due: twoDaysAgo,
        assignee: 'Elena Rostova',
        blocker: 'Waiting for Atlas IOPS provisioning approval',
        creator: admin._id,
      },
      {
        title: 'Deliver Q4 compliance audit documentation',
        description: 'Prepare data sovereignty statements for enterprise partners.',
        projectId: p2._id.toString(),
        project: p2._id,
        status: 'doing',
        priority: 'high',
        due: yesterday,
        assignee: 'Marcus Vance',
        blocker: 'External legal questionnaire pending review',
        creator: admin._id,
      },
      {
        title: 'Finalize client meeting slide deck and agenda',
        description: 'Structure agenda around intent classification and real-time UI reorganization.',
        projectId: p2._id.toString(),
        project: p2._id,
        status: 'doing',
        priority: 'high',
        due: todayStr,
        assignee: 'Alex Rivera',
        blocker: '',
        creator: user._id,
      },
      {
        title: 'Deploy automated test runner and verification pipeline',
        description: 'Verify all 21 unit tests pass and integrate into continuous build checks.',
        projectId: p1._id.toString(),
        project: p1._id,
        status: 'todo',
        priority: 'medium',
        due: tomorrow,
        assignee: 'Alex Rivera',
        blocker: '',
        creator: user._id,
      },
      {
        title: 'Implement dark mode accessibility contrast check',
        description: 'Verify 4.5:1 text-to-background contrast across all warm charcoal cards.',
        projectId: p1._id.toString(),
        project: p1._id,
        status: 'todo',
        priority: 'medium',
        due: in3Days,
        assignee: 'Sarah Chen',
        blocker: '',
        creator: user._id,
      },
      {
        title: 'Review Google Meet transcript pipeline heuristics',
        description: 'Benchmark filler word removal and speaker talk-time distribution precision.',
        projectId: p2._id.toString(),
        project: p2._id,
        status: 'todo',
        priority: 'low',
        due: in5Days,
        assignee: 'Dev Team',
        blocker: '',
        creator: admin._id,
      },
      {
        title: 'Build deterministic intent classification rule engine',
        description: 'Modular keyword and weight classifier with 5 intent categories.',
        projectId: p1._id.toString(),
        project: p1._id,
        status: 'done',
        priority: 'high',
        due: twoDaysAgo,
        assignee: 'Alex Rivera',
        completedAt: new Date(today.getTime() - 86400000),
        creator: user._id,
      },
      {
        title: 'Configure Express JWT authentication middleware',
        description: 'Cryptographic token validation with secure user session restoration.',
        projectId: p3._id.toString(),
        project: p3._id,
        status: 'done',
        priority: 'high',
        due: twoDaysAgo,
        assignee: 'Marcus Vance',
        completedAt: new Date(today.getTime() - 86400000 * 2),
        creator: admin._id,
      },
      {
        title: 'Design Dusk Rose editorial typography theme system',
        description: 'Pair Playfair serif headlines with Inter sans-serif productivity controls.',
        projectId: p1._id.toString(),
        project: p1._id,
        status: 'done',
        priority: 'medium',
        due: yesterday,
        assignee: 'Sarah Chen',
        completedAt: new Date(today.getTime() - 86400000),
        creator: user._id,
      },
      {
        title: 'Audit frontend routes and remove mock dependencies',
        description: 'Guarantee real API service calls and honest loading/empty states.',
        projectId: p3._id.toString(),
        project: p3._id,
        status: 'done',
        priority: 'high',
        due: twoDaysAgo,
        assignee: 'Elena Rostova',
        completedAt: new Date(today.getTime() - 86400000 * 2),
        creator: admin._id,
      },
    ]);

    // 6. Create Meetings
    console.log('[6/7] Seeding meetings with agendas and checklists...');
    await Meeting.create([
      {
        title: "Q4 Executive Client Review with Acme Corp",
        client: 'Acme Global Ventures',
        date: tomorrow,
        time: '10:00 AM',
        timezone: 'EST',
        agenda: '1. Architecture walkthrough\n2. Real-time adaptation demo\n3. Enterprise privacy review',
        notes: 'Client lead David Sterling requested zero-external-LLM data sovereignty guarantees.',
        checklist: [
          { id: '1', text: 'Prepare adaptation live demo on staging', done: true },
          { id: '2', text: 'Confirm attendee roster with Acme leads', done: false },
        ],
        actions: [
          { id: '1', text: 'Share executive summary PDF after call', done: false },
        ],
        host: admin._id,
        attendees: ['David Sterling', 'Alex Rivera', 'Sarah Chen'],
        meetUrl: 'https://meet.google.com/nex-acme-q4',
        status: 'scheduled',
        reportStatus: 'none',
      },
      {
        title: 'Sprint Architecture Sync: Intent-to-Interface',
        client: 'Internal Core Team',
        date: todayStr,
        time: '02:30 PM',
        timezone: 'UTC',
        agenda: '1. Verify 21 automated test suite checks\n2. Review MongoDB seed data consistency\n3. Test E2E user flow',
        notes: 'Confirm all 6 workspaces operating without mock flags.',
        checklist: [
          { id: '1', text: 'Run backend test runner and verify 0 failures', done: true },
          { id: '2', text: 'Check dark mode styling on all routes', done: false },
        ],
        actions: [
          { id: '1', text: 'Record walkthrough demo video', done: false },
        ],
        host: user._id,
        attendees: ['Alex Rivera', 'Elena Rostova', 'Marcus Vance'],
        meetUrl: 'https://meet.google.com/nex-sprint-core',
        status: 'scheduled',
        reportStatus: 'none',
      },
      {
        title: 'Cloud Infrastructure & Security Audit',
        client: 'Apex Tech Dynamics',
        date: in3Days,
        time: '11:00 AM',
        timezone: 'PST',
        agenda: '1. MongoDB connection pooling & timeout policies\n2. Role-based admin route security',
        notes: 'Discuss replica set failover latency benchmarks.',
        checklist: [
          { id: '1', text: 'Export activity audit log for inspector', done: false },
        ],
        actions: [],
        host: admin._id,
        attendees: ['Apex Security Lead', 'Alex Rivera'],
        meetUrl: 'https://meet.google.com/nex-sec-audit',
        status: 'scheduled',
        reportStatus: 'none',
      },
    ]);

    // 7. Create Messages & Courses
    console.log('[7/7] Seeding messages, learning courses, and activity logs...');
    await Message.create([
      {
        from: 'David Sterling (Acme Corp)',
        subject: "Excited for tomorrow's client kickoff review",
        body: 'Hello team, we reviewed the preliminary documentation for Nexora. The deterministic adaptation concept is exactly what our compliance team requested. Looking forward to our 10:00 AM meeting tomorrow.',
        priority: 'high',
        unread: true,
        date: todayStr,
        sender: admin._id,
      },
      {
        from: 'Sarah Chen (Engineering)',
        subject: 'MongoDB collections and indexing verified',
        body: 'All collections have been verified. The test suite passes 21/21 checks. Ready for end-to-end user testing.',
        priority: 'normal',
        unread: true,
        date: todayStr,
        sender: user._id,
      },
      {
        from: 'Security Daemon',
        subject: 'Automated cryptographic security audit completed',
        body: 'Cryptographic token validation passed with zero vulnerabilities detected across all routes.',
        priority: 'low',
        unread: false,
        date: yesterday,
        sender: admin._id,
      },
      {
        from: 'Marcus Vance (Operations)',
        subject: 'Q4 Roadmap Review feedback and overdue task',
        body: 'Please check the overdue audit task on the projects board when you have a moment.',
        priority: 'high',
        unread: true,
        date: todayStr,
        sender: admin._id,
      },
    ]);

    await Course.create([
      {
        name: 'Distributed Systems & Cloud Architecture',
        title: 'Distributed Systems & Cloud Architecture',
        description: 'In-depth mastery of consensus algorithms, replica sets, and horizontal scaling.',
        category: 'Engineering',
        topics: [
          { id: '1', name: 'Replica Sets & Sharding in Document Stores', done: true },
          { id: '2', name: 'Eventual Consistency Models & Vector Clocks', done: true },
          { id: '3', name: 'Raft Consensus Protocol & Leader Election', done: false },
          { id: '4', name: 'CAP Theorem in Production Systems', done: false },
        ],
        assessment: { title: 'Mid-term Assessment', date: in5Days },
        quizBest: 88,
        isPublished: true,
      },
      {
        name: 'Operating Systems & Concurrency',
        title: 'Operating Systems & Concurrency',
        description: 'Memory paging, threads, race conditions, and synchronization primitives.',
        category: 'Computer Science',
        topics: [
          { id: '1', name: 'Process Scheduling Algorithms & Context Switches', done: true },
          { id: '2', name: 'Virtual Memory Paging & TLB Caches', done: true },
          { id: '3', name: 'Deadlock Detection, Prevention & Bankers Algorithm', done: false },
        ],
        assessment: { title: 'Final Comprehensive Exam', date: in3Days },
        quizBest: 92,
        isPublished: true,
      },
      {
        name: 'Full-Stack Software Architecture',
        title: 'Full-Stack Software Architecture',
        description: 'Modern MERN architecture with TypeScript, Zod validation, and responsive UI.',
        category: 'Software Engineering',
        topics: [
          { id: '1', name: 'MERN Stack Separation of Concerns', done: true },
          { id: '2', name: 'Secure JWT Cryptography & Session Management', done: true },
          { id: '3', name: 'Deterministic Rule Engines & State Normalization', done: true },
        ],
        assessment: { title: 'Capstone Project Evaluation', date: '2026-11-15' },
        quizBest: 96,
        isPublished: true,
      },
    ]);

    await ActivityLog.create([
      {
        actor: 'Nexora Bootstrap',
        action: 'SYSTEM_BOOTSTRAP',
        detail: 'Sample projects, tasks, meetings, and users seeded successfully',
        level: 'info',
        time: new Date(),
      },
      {
        actor: 'Admin User',
        action: 'PROJECT_INITIALIZED',
        detail: 'Created "Adaptive Workspace Core 2.0" milestone',
        level: 'info',
        time: new Date(today.getTime() - 86400000),
      },
      {
        actor: 'Alex Rivera',
        action: 'INTENT_ADAPTATION',
        detail: 'Tested intent: "Prepare me for tomorrow\'s client meeting"',
        level: 'info',
        time: new Date(today.getTime() - 3600000),
      },
    ]);

    console.log('\n=============================================');
    console.log(' SEED COMPLETED SUCCESSFULLY!');
    console.log(' Credentials:');
    console.log('   Admin: admin@nexora.dev / Admin@1234567');
    console.log('   User:  user@nexora.dev  / User@1234567');
    console.log('=============================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('[Database] Disconnected cleanly.');
  }
}

seed().catch((err) => {
  console.error('\n[Error] Seed failed:', err);
  process.exit(1);
});
