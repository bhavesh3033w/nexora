# Hero video

The landing hero plays `public/videos/nexora-office.mp4` (browser URL `/videos/nexora-office.mp4`) as a decorative, muted, looping background.

**The video file was NOT included in the project you uploaded.** Copy your file to `public/videos/nexora-office.mp4` (exact name). Until then the hero shows the normal warm static gradient — nothing breaks and no broken-video icon appears.

## Behaviour
- Component: `src/components/HeroVideo.tsx`; styles at the end of `src/styles/global.css` (`.hv*`).
- Fades in only after the `playing` event; the overlay (cream / dusky-rose / mocha gradients + edge masks) fades with it.
- Missing file, decode error or blocked autoplay → the `<video>` is removed, static background stays.
- `prefers-reduced-motion` → video is not rendered. Paused while off-screen. Never captures pointer events (`pointer-events:none`), sits at z-index 0 beneath the hero content.
- Tuning: final video opacity `.hv.on .hv-video{opacity:.55}`, focal point `object-position`, wash strength in `.hv-wash`.

## Optimising a large file (target: under ~6–8 MB, 1080p, no audio)
```bash
ffmpeg -i input.mp4 -an -vf "scale=-2:1080,fps=30" -c:v libx264 -crf 24 -preset slow \
  -profile:v high -pix_fmt yuv420p -movflags +faststart public/videos/nexora-office.mp4
# optional poster (then <HeroVideo poster="/videos/nexora-office-poster.jpg" />)
ffmpeg -i input.mp4 -ss 1 -frames:v 1 -vf scale=1600:-2 -q:v 3 public/videos/nexora-office-poster.jpg
```
`-crf 22–26` keeps quality visually clean at this reduced opacity; lower fps/resolution further if the file is still heavy.
