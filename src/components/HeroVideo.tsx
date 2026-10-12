import { useEffect, useRef, useState } from 'react';

/** Public URL of the supplied office video (file lives at public/videos/nexora-office.mp4). */
export const HERO_VIDEO_SRC = '/videos/nexora-office.mp4';
type Phase = 'loading' | 'playing' | 'off';
const reducedQuery = () => matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Decorative, muted, looping office video that sits BEHIND the hero content.
 * - Fades in only once playback has actually started ('playing' event).
 * - If the file is missing, undecodable, or autoplay is blocked, the <video> is removed
 *   and the warm static gradient stays (no broken-video icon, no layout shift).
 * - Not rendered at all under prefers-reduced-motion.
 * - Paused while the hero is off-screen. Never intercepts pointer events.
 */
export default function HeroVideo({ src = HERO_VIDEO_SRC, poster }: { src?: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && reducedQuery().matches);
  const [phase, setPhase] = useState<Phase>('loading');
  const off = phase === 'off';

  useEffect(() => {
    const mq = reducedQuery(); const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const v = ref.current; if (!v || reduced || off) return;
    v.muted = true; v.defaultMuted = true; // required for autoplay; never plays sound
    const onPlaying = () => setPhase('playing'); const onError = () => setPhase('off');
    v.addEventListener('playing', onPlaying); v.addEventListener('error', onError);
    v.play()?.catch((e: unknown) => { if ((e as { name?: string })?.name !== 'AbortError') setPhase('off'); });
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play()?.catch(() => undefined); else v.pause(); });
      io.observe(v);
    }
    return () => { io?.disconnect(); v.removeEventListener('playing', onPlaying); v.removeEventListener('error', onError); v.pause(); };
  }, [reduced, off]);

  const show = !reduced && !off;
  return (
    <div className={'hv' + (show && phase === 'playing' ? ' on' : '')} aria-hidden="true">
      <div className="hv-static" />
      {show && (
        <div className="hv-media">
          <video ref={ref} className="hv-video" src={src} poster={poster} autoPlay muted loop playsInline preload="metadata"
            tabIndex={-1} disablePictureInPicture disableRemotePlayback />
        </div>
      )}
      <div className="hv-wash" />
    </div>
  );
}
