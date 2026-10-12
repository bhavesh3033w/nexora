import { useRef, type ReactNode } from 'react';
/** Pointer-reactive tilt. Mutates transform via ref (no React re-render) and ignores touch/pen input. */
export default function Tilt({ children, className = '', max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const b = ref.current.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    ref.current.style.transform = `perspective(800px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <div ref={ref} className={'tilt ' + className} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}
