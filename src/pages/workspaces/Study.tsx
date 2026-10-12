import { useState } from 'react';
import { Banner, Empty, ErrorState, Modal, NeedsBackend, Page, Progress, Ring, Skeletons } from '../../components/ui';
import { courseProgress } from '../../features/adaptive/Widgets';
import { errorMessage } from '../../api/client';
import { workspaceServices } from '../../api/services';
import { useResource } from '../../api/useResource';
import TutorialLibrary from '../../features/tutorials/TutorialLibrary';

export default function Study() {
  const res = useResource(() => workspaceServices.list('courses')); const courses = res.data ?? [];
  const [openId, setOpenId] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const course = courses.find(c => c.id === openId);
  const plan = courses.find(c => (c.topics ?? []).some(t => !t.done));
  const toggleTopic = async (cid: string, tid: string) => {
    const c = courses.find(x => x.id === cid); if (!c) return; setBusy(true); setErr('');
    try { await workspaceServices.update('courses', cid, { ...c, topics: c.topics.map(t => t.id === tid ? { ...t, done: !t.done } : t) }); await res.refresh(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Page title="Study & Learning" sub="Courses, topics and tutorials">
      {res.error && <ErrorState message={res.error} onRetry={res.retry} />}{err && <Banner kind="error">{err}</Banner>}
      {res.loading ? <Skeletons n={3} /> : res.error ? null : !courses.length ? <Empty title="No courses yet">Courses returned by the server will appear here.</Empty> : <>
        <div className="grid g3 stagger">{courses.map(c => <button key={c.id} className="card hover row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpenId(c.id)}><Ring value={courseProgress(c)} /><div><b>{c.name}</b>{c.assessment && <div className="muted small">{c.assessment.title} · {c.assessment.date}</div>}{c.quizBest !== null && c.quizBest !== undefined && <div className="small">Best quiz score: {c.quizBest}</div>}</div></button>)}</div>
        <div className="card col"><h3 style={{ fontSize: '1.05em' }}>Suggested study order{plan ? ` — ${plan.name}` : ''}</h3><ul className="list">{plan ? plan.topics.filter(t => !t.done).slice(0, 3).map((t, i) => <li key={t.id}><span className="tag pri">Next {i + 1}</span>{t.name}</li>) : <li>All topics complete</li>}</ul></div></>}
      <div className="grid g2"><NeedsBackend feature="Quizzes and flashcards" needs="quiz and flashcard endpoints (none are defined in the API contract yet)" /><NeedsBackend feature="Learning goals and study streak" needs="learning-goal and streak endpoints (none are defined in the API contract yet)" /></div>
      <TutorialLibrary />
      <Modal open={!!course} title={course?.name ?? ''} onClose={() => setOpenId('')}>{course && <><Progress value={courseProgress(course)} label="Course progress" /><ul className="list">{(course.topics ?? []).map(t => <li key={t.id}><input className="check" id={'t' + t.id} type="checkbox" disabled={busy} checked={t.done} onChange={() => void toggleTopic(course.id, t.id)} /><label htmlFor={'t' + t.id} className={t.done ? 'done' : ''}>{t.name}</label></li>)}</ul>{course.assessment && <span className="muted small">Upcoming: {course.assessment.title} on {course.assessment.date}</span>}{err && <Banner kind="error">{err}</Banner>}</>}</Modal>
    </Page>
  );
}
