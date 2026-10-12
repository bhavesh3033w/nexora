import { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Search } from 'lucide-react';
import { Empty } from '../../components/ui';
import { useLocalState } from '../../lib/storage';
import { TUTORIALS, TUTORIAL_CATEGORIES } from './courses';

type Filter = 'all' | 'free' | 'paid';
export default function TutorialLibrary() {
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [bookmarks, setBookmarks] = useLocalState<string[]>('tutorialBookmarks', []);
  const [savedOnly, setSavedOnly] = useState(false);
  const toggle = (id: string) => setBookmarks(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TUTORIALS.filter(c => (filter === 'all' || c.pricing === filter) && (cat === 'All' || c.category === cat) && (!savedOnly || bookmarks.includes(c.id))
      && (!s || [c.title, c.provider, c.category, c.description].some(x => x.toLowerCase().includes(s))));
  }, [filter, cat, q, savedOnly, bookmarks]);
  const count = (f: Filter) => TUTORIALS.filter(c => f === 'all' || c.pricing === f).length;
  return (
    <section className="card col" aria-labelledby="tutorial-lib-h" id="tutorial-library" data-testid="tutorial-library">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3 id="tutorial-lib-h" style={{ fontSize: '1.05em' }}>Tutorial Library</h3>
        <span className="muted small">{list.length} of {TUTORIALS.length} courses · {bookmarks.length} bookmarked (saved in this browser)</span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }} role="group" aria-label="Filter by price">
        {(['all', 'free', 'paid'] as Filter[]).map(f => <button key={f} className={'chip' + (filter === f ? ' on' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)} ({count(f)})</button>)}
        <button className={'chip' + (savedOnly ? ' on' : '')} aria-pressed={savedOnly} onClick={() => setSavedOnly(v => !v)}>Bookmarked</button>
      </div>
      <div className="row" style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, opacity: .6 }} aria-hidden />
        <input className="input" style={{ paddingLeft: 36 }} type="search" aria-label="Search tutorials" placeholder="Search courses, providers or topics" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }} role="group" aria-label="Filter by category">
        {['All', ...TUTORIAL_CATEGORIES].map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {list.length === 0 ? <Empty title="No courses found">Try a different search, category or filter.</Empty> :
        <div className="grid g3">{list.map(c => {
          const saved = bookmarks.includes(c.id);
          return (
            <article key={c.id} className="card col">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={'tag ' + (c.pricing === 'free' ? 'ok' : 'pri')}>{c.pricing === 'free' ? 'Free' : 'Paid'}</span>
                <button className="icon-btn" aria-label={saved ? `Remove bookmark: ${c.title}` : `Bookmark ${c.title}`} aria-pressed={saved} onClick={() => toggle(c.id)}>{saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
              </div>
              <b>{c.title}</b>
              <div className="muted small">{c.provider} · {c.category}</div>
              <div className="small">{c.description}</div>
              <div className="muted small">{c.level} · {c.duration}{c.price ? ` · ${c.price}` : ''}</div>
              <a className="btn sm" href={c.url} target="_blank" rel="noopener noreferrer">Open course <ExternalLink size={14} aria-hidden /></a>
            </article>);
        })}</div>}
    </section>
  );
}
