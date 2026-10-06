/** Static contour-map poster: the no-WebGL / reduced-power fallback. Decorative only. */
export function Poster() {
  return (
    <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[70%] w-full text-pp-accent opacity-25" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" fill="none" stroke="currentColor" strokeWidth="1">
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M-20 ${560 - i * 36} C 220 ${520 - i * 40}, 380 ${600 - i * 34}, 600 ${540 - i * 38} S 980 ${500 - i * 36}, 1220 ${550 - i * 34}`} />
      ))}
    </svg>
  );
}
