import React, { useEffect, useId, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * StrokeAegis assistant mascot — a hand-built vector redraw of Mahmood's
 * original robot doctor (assets/medical_robot_transparent.svg): white/blue
 * rounded head with ear pods, dark glossy visor with glowing cyan eyes and a
 * smile, brain/AI emblem on the forehead, lab coat with stethoscope and a
 * thumbs-up hand, floating on a glowing hover base.
 */
export type RobotMood = 'wave' | 'thinking' | 'happy' | 'alert';

export interface RobotMascotProps {
  variant?: 'full' | 'head';
  size?: number;
  message?: string;
  mood?: RobotMood;
  className?: string;
  /** Gaze direction, each axis -1..1 (e.g. toward the mouse). Pupils + head follow it. */
  look?: { x: number; y: number } | null;
  /** Follow the mouse pointer with the eyes/head (ignored when `look` is given). */
  trackPointer?: boolean;
}

/** Gaze vector (-1..1) from an element's eye line to the mouse pointer. */
export function usePointerGaze(ref: React.RefObject<Element | null>, enabled: boolean): { x: number; y: number } | null {
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 32) return; // ~30 fps is plenty for eyes
      last = now;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.32; // eye line
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      setGaze({ x: clamp((e.clientX - cx) / 420), y: clamp((e.clientY - cy) / 320) });
    };
    const onLeave = () => setGaze(null);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, enabled]);
  return gaze;
}

const FULL_VB = { x: 0, y: 0, w: 200, h: 258 };
const HEAD_VB = { x: 12, y: 10, w: 176, h: 122 };

const C = {
  teal: '#0E7490',
  cyan: '#22D3EE',
  cyan2: '#06B6D4',
  ink: '#0F2A2E',
  surface: '#E6F6F8',
  line: '#BFE3EA',
  amber: '#F59E0B',
};

const ROBOT_CSS = `
.sa-robot .sa-float{animation:sa-float 3.6s ease-in-out infinite}
.sa-robot .sa-shadow{transform-box:fill-box;transform-origin:center;animation:sa-shadow 3.6s ease-in-out infinite}
.sa-robot .sa-blink{transform-box:fill-box;transform-origin:center;animation:sa-blink 5.2s ease-in-out infinite}
.sa-robot .sa-pulse{animation:sa-pulse 2.4s ease-in-out infinite}
.sa-robot .sa-wave{transform-box:view-box;transform-origin:64px 146px;animation:sa-wave 1.5s ease-in-out infinite}
.sa-robot .sa-tilt{transform-box:view-box;transform-origin:100px 128px;animation:sa-tilt 1.8s ease-in-out infinite}
.sa-robot .sa-look{animation:sa-look 3s ease-in-out infinite}
.sa-robot .sa-dot{animation:sa-dot 1.2s ease-in-out infinite}
.sa-robot .sa-alert{animation:sa-pulse 0.9s ease-in-out infinite}
@keyframes sa-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes sa-shadow{0%,100%{transform:scaleX(1);opacity:.16}50%{transform:scaleX(.84);opacity:.09}}
@keyframes sa-blink{0%,88%,100%{transform:scaleY(1)}91%{transform:scaleY(.08)}94%{transform:scaleY(1)}}
@keyframes sa-pulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes sa-wave{0%,100%{transform:rotate(0deg)}25%{transform:rotate(16deg)}50%{transform:rotate(-4deg)}75%{transform:rotate(12deg)}}
@keyframes sa-tilt{0%,100%{transform:rotate(0deg)}30%{transform:rotate(-6deg)}70%{transform:rotate(5deg)}}
@keyframes sa-look{0%,100%{transform:translate(2px,-3.5px)}50%{transform:translate(-1.5px,-3.5px)}}
@keyframes sa-dot{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-1.6px)}}
@media (prefers-reduced-motion: reduce){.sa-robot *,.sa-robot{animation:none!important}}
`;

const BROWS: Record<RobotMood | 'idle', [string, string]> = {
  idle: ['M71 71 Q80 66 89 71', 'M111 71 Q120 66 129 71'],
  wave: ['M71 71 Q80 66 89 71', 'M111 71 Q120 66 129 71'],
  happy: ['M71 69 Q80 63 89 69', 'M111 69 Q120 63 129 69'],
  thinking: ['M71 71 Q80 67 89 71', 'M111 68 Q120 61 129 66'],
  alert: ['M71 72 Q80 70 89 66', 'M111 66 Q120 70 129 72'],
};

/** Inner SVG content — exported so the static showcase can be generated from the same source. */
const RobotArt: React.FC<{ uid: string; variant: 'full' | 'head'; mood?: RobotMood; look?: { x: number; y: number } | null }> = ({
  uid,
  variant,
  mood,
  look,
}) => {
  const gaze = look && mood !== 'thinking' ? look : null;
  const pupilStyle: React.CSSProperties | undefined = gaze
    ? { transform: `translate(${(gaze.x * 5.5).toFixed(2)}px, ${(gaze.y * 4.5).toFixed(2)}px)`, transition: 'transform 120ms ease-out' }
    : { transition: 'transform 300ms ease-out' };
  const id = (n: string) => `sa${uid}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const alert = mood === 'alert';
  const eyeMain = alert ? C.amber : C.cyan;
  const [browL, browR] = BROWS[mood ?? 'idle'];

  const eye = (cx: number) => (
    <g className="sa-blink">
      <circle cx={cx} cy={88} r={16} fill={eyeMain} opacity={0.32} filter={url('blur')} />
      <circle cx={cx} cy={88} r={13.5} fill={url('iris')} stroke={alert ? '#FDE68A' : '#A5F3FC'} strokeOpacity={0.7} strokeWidth={1} />
      <g className={mood === 'thinking' ? 'sa-look' : undefined} style={mood === 'thinking' ? undefined : pupilStyle}>
        <circle cx={cx} cy={88} r={6.6} fill="#04161B" />
        <circle cx={cx + 4} cy={84} r={3.1} fill="#FFFFFF" />
        <circle cx={cx - 3.9} cy={92.2} r={1.4} fill="#FFFFFF" opacity={0.85} />
      </g>
    </g>
  );

  const happyEye = (cx: number) => (
    <g>
      <path d={`M${cx - 10} 92 Q${cx} 79 ${cx + 10} 92`} fill="none" stroke={C.cyan} strokeWidth={6} strokeLinecap="round" opacity={0.35} filter={url('blur')} />
      <path d={`M${cx - 10} 92 Q${cx} 79 ${cx + 10} 92`} fill="none" stroke={url('iris')} strokeWidth={4.2} strokeLinecap="round" />
    </g>
  );

  const mouth = () => {
    if (mood === 'thinking') {
      return [92, 100, 108].map((x, i) => (
        <circle key={x} className="sa-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={x} cy={107} r={2.1} fill={C.cyan} />
      ));
    }
    if (alert) return <path d="M93 107.5 Q100 104.5 107 107.5" fill="none" stroke={C.amber} strokeWidth={2.6} strokeLinecap="round" />;
    if (mood === 'happy') return <path d="M88 102 Q100 116 112 102 Q100 109 88 102 Z" fill={C.cyan} />;
    return <path d="M91 103.5 Q100 112 109 103.5 Q100 107.8 91 103.5 Z" fill={C.cyan} />;
  };

  const head = (
    <g
      style={{
        transformBox: 'view-box',
        transformOrigin: '100px 128px',
        transform: gaze ? `translate(${(gaze.x * 2.5).toFixed(2)}px, ${(gaze.y * 1.5).toFixed(2)}px) rotate(${(gaze.x * 5).toFixed(2)}deg)` : undefined,
        transition: 'transform 220ms ease-out',
      }}
    >
    <g className={variant === 'head' && mood === 'wave' ? 'sa-tilt' : undefined}>
      {/* shell */}
      <path d="M100 14 C140 14 166 40 168 78 C170 108 152 126 124 128 L76 128 C48 126 30 108 32 78 C34 40 60 14 100 14 Z" fill={url('shell')} stroke={C.line} strokeWidth={1} />
      <path d="M60 34 C72 22 88 18 100 18 C88 22 74 30 66 44 Z" fill="#FFFFFF" opacity={0.9} />
      {/* ear pods */}
      {[30, 170].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={88} rx={13} ry={22} fill={url('blue')} />
          <ellipse cx={x} cy={88} rx={7.5} ry={14.5} fill={C.surface} />
          <ellipse className="sa-pulse" cx={x} cy={88} rx={4} ry={9} fill="none" stroke={C.cyan} strokeWidth={1.8} />
        </g>
      ))}
      {/* face bezel + visor */}
      <rect x={42} y={54} width={116} height={70} rx={32} fill="#D7EFF4" />
      <rect x={48} y={60} width={104} height={58} rx={26} fill={url('visor')} />
      <rect x={48} y={60} width={104} height={58} rx={26} fill="none" stroke={eyeMain} strokeOpacity={0.35} strokeWidth={1.2} className={alert ? 'sa-alert' : undefined} />
      <path d="M58 76 Q60 64 76 63 L104 63 Q82 66 62 84 Z" fill="#FFFFFF" opacity={0.16} />
      <circle cx={140} cy={68} r={1.8} fill="#FFFFFF" opacity={0.35} />
      {/* brows */}
      <path transform="translate(0 -2.5)" d={browL} fill="none" stroke={eyeMain} strokeWidth={2.6} strokeLinecap="round" />
      <path transform="translate(0 -2.5)" d={browR} fill="none" stroke={eyeMain} strokeWidth={2.6} strokeLinecap="round" />
      {/* eyes */}
      {mood === 'happy' ? (
        <>
          {happyEye(80)}
          {happyEye(120)}
          <ellipse cx={64} cy={103} rx={5} ry={2.6} fill="#F9A8D4" opacity={0.5} />
          <ellipse cx={136} cy={103} rx={5} ry={2.6} fill="#F9A8D4" opacity={0.5} />
        </>
      ) : (
        <>
          {eye(80)}
          {eye(120)}
        </>
      )}
      <g transform="translate(0 2)">{mouth()}</g>
      {/* brain / AI emblem */}
      <g transform="translate(100 37) scale(1.28) translate(-100 -36)">
        <ellipse cx={100} cy={36} rx={18} ry={7} fill="none" stroke={url('blue')} strokeWidth={2} transform="rotate(-28 100 36)" />
        <ellipse cx={100} cy={36} rx={18} ry={7} fill="none" stroke={url('blue')} strokeWidth={2} transform="rotate(28 100 36)" />
        <circle className="sa-pulse" cx={100} cy={36} r={14} fill={C.cyan} opacity={0.5} filter={url('blur')} />
        <circle cx={100} cy={36} r={11} fill={url('emblem')} stroke="#FFFFFF" strokeWidth={1.4} />
        <path d="M98.5 28.5 C94 27 89.5 30 90.5 34 C88 36 89 41 92.5 41.5 C93.5 44 97 44.5 98.5 43 M101.5 28.5 C106 27 110.5 30 109.5 34 C112 36 111 41 107.5 41.5 C106.5 44 103 44.5 101.5 43" fill="none" stroke={C.surface} strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={100} cy={36} r={4.6} fill={url('gold')} />
        <text x={100} y={37.7} textAnchor="middle" fontSize={4.6} fontWeight={800} fontFamily="Figtree, Arial, sans-serif" fill={C.ink}>AI</text>
      </g>
    </g>
    </g>
  );

  return (
    <>
      <defs>
        <linearGradient id={id('shell')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F3FBFC" />
          <stop offset="1" stopColor="#CDEAF0" />
        </linearGradient>
        <linearGradient id={id('blue')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.cyan} />
          <stop offset="0.55" stopColor={C.cyan2} />
          <stop offset="1" stopColor={C.teal} />
        </linearGradient>
        <linearGradient id={id('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173B42" />
          <stop offset="0.5" stopColor={C.ink} />
          <stop offset="1" stopColor="#061215" />
        </linearGradient>
        <radialGradient id={id('iris')} cx="0.45" cy="0.38" r="0.65">
          <stop offset="0" stopColor={alert ? '#FEF3C7' : '#CFFAFE'} />
          <stop offset="0.45" stopColor={alert ? C.amber : C.cyan} />
          <stop offset="1" stopColor={alert ? '#DC2626' : '#0891B2'} />
        </radialGradient>
        <radialGradient id={id('emblem')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={C.cyan} />
          <stop offset="1" stopColor={C.teal} />
        </radialGradient>
        <radialGradient id={id('gold')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#D97706" />
        </radialGradient>
        <radialGradient id={id('steel')} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#94A3B8" />
        </radialGradient>
        <radialGradient id={id('ground')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={C.cyan} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.cyan} stopOpacity="0" />
        </radialGradient>
        <filter id={id('blur')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      {variant === 'head' ? (
        head
      ) : (
        <>
          <ellipse className="sa-shadow" cx={100} cy={250} rx={34} ry={4.5} fill={C.ink} opacity={0.16} />
          <g className="sa-float">
            {/* hover base */}
            <ellipse className="sa-pulse" cx={100} cy={236} rx={38} ry={8} fill={url('ground')} />
            <ellipse className="sa-pulse" cx={100} cy={235} rx={27} ry={4.5} fill="none" stroke={C.cyan} strokeWidth={1.6} />
            <rect x={79} y={208} width={42} height={14} rx={4} fill={url('blue')} />
            <path d="M76 218 L124 218 L120 229 Q100 234 80 229 Z" fill={url('shell')} stroke={C.line} strokeWidth={0.8} />
            <path d="M78 223.5 Q100 227.5 122 223.5" fill="none" stroke={C.cyan} strokeWidth={2} strokeLinecap="round" />

            {/* neck */}
            <rect x={88} y={120} width={24} height={16} rx={5} fill={C.ink} />

            {/* open hand arm (viewer's right) */}
            <path d="M136 146 C150 156 160 166 162 180" fill="none" stroke={C.line} strokeWidth={17} strokeLinecap="round" />
            <path d="M136 146 C150 156 160 166 162 180" fill="none" stroke="#F7FCFD" strokeWidth={15} strokeLinecap="round" />
            <rect x={152.5} y={178} width={19} height={7} rx={3.5} fill={url('blue')} />
            <rect x={150} y={183} width={7} height={11} rx={3.5} fill={url('shell')} stroke={C.line} strokeWidth={0.8} transform="rotate(-30 153.5 188.5)" />
            <rect x={154} y={184} width={19} height={15} rx={7} fill={url('shell')} stroke={C.line} strokeWidth={0.8} />
            <path d="M158 192 h11 M158 195.5 h10" stroke={C.cyan2} strokeWidth={1.3} strokeLinecap="round" opacity={0.8} />

            {/* lab coat */}
            <path d="M62 142 C66 134 80 131 100 131 C120 131 134 134 138 142 L145 204 C146 211 141 215 134 215 L66 215 C59 215 54 211 55 204 Z" fill={url('shell')} stroke={C.line} strokeWidth={0.9} />
            <path d="M86 132 L100 158 L114 132 Z" fill={url('blue')} />
            <path d="M84 132 L95 160 L100 172 L105 160 L116 132" fill="none" stroke={C.line} strokeWidth={1.3} strokeLinejoin="round" />
            <path d="M100 172 L100 214" stroke={C.line} strokeWidth={1.1} />
            <circle cx={104} cy={184} r={1.6} fill="#9CCFDA" />
            <circle cx={104} cy={198} r={1.6} fill="#9CCFDA" />
            <rect x={64} y={188} width={22} height={14} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
            <path d="M64 188 h22" stroke={C.cyan} strokeWidth={1.8} strokeLinecap="round" />
            <rect x={116} y={196} width={20} height={12} rx={3} fill="none" stroke={C.line} strokeWidth={1} />
            <path d="M116 196 h20" stroke={C.cyan} strokeWidth={1.8} strokeLinecap="round" />
            <circle cx={127} cy={152} r={5.5} fill={url('emblem')} stroke="#FFFFFF" strokeWidth={1} />
            <circle cx={127} cy={152} r={2} fill={url('gold')} />

            {/* stethoscope */}
            <path d="M87 133 C80 148 86 166 97 175 Q100 178 103 175 C114 166 120 148 113 133" fill="none" stroke={C.teal} strokeWidth={2.6} strokeLinecap="round" />
            <path d="M100 177 C100 184 104 188 107 189" fill="none" stroke={C.teal} strokeWidth={2.6} strokeLinecap="round" />
            <circle cx={111} cy={191} r={5.5} fill={url('steel')} stroke="#64748B" strokeWidth={0.8} />
            <circle cx={111} cy={191} r={2.8} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.6} />

            {/* thumbs-up arm (viewer's left) */}
            <g className={mood === 'wave' ? 'sa-wave' : undefined}>
              <path d="M64 146 C52 158 30 166 24 154" fill="none" stroke={C.line} strokeWidth={17} strokeLinecap="round" />
              <path d="M64 146 C52 158 30 166 24 154" fill="none" stroke="#F7FCFD" strokeWidth={15} strokeLinecap="round" />
              <rect x={13} y={145} width={21} height={7} rx={3.5} fill={url('blue')} />
              <rect x={15} y={112} width={9.5} height={21} rx={4.75} fill={url('shell')} stroke={C.line} strokeWidth={0.8} />
              <rect x={12} y={127} width={22} height={19} rx={8} fill={url('shell')} stroke={C.line} strokeWidth={0.8} />
              <path d="M26 132.5 h6 M26 137 h6 M26 141.5 h5" stroke={C.cyan2} strokeWidth={1.5} strokeLinecap="round" />
            </g>

            {head}
          </g>
        </>
      )}
    </>
  );
};

export const RobotMascot: React.FC<RobotMascotProps> = ({ variant = 'full', size, message, mood, className = '', look, trackPointer = false }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerGaze = usePointerGaze(svgRef, trackPointer && look === undefined);
  const gaze = look !== undefined ? look : pointerGaze;
  const vb = variant === 'head' ? HEAD_VB : FULL_VB;
  const width = size ?? (variant === 'head' ? 40 : 180);
  const height = Math.round((width * vb.h) / vb.w);
  const isFull = variant === 'full';

  return (
    <div className={`sa-robot inline-flex gap-3 ${isFull ? 'items-start' : 'items-center'} ${className}`}>
      <style>{ROBOT_CSS}</style>
      <svg
        ref={svgRef}
        role="img"
        aria-label="StrokeAegis assistant"
        width={width}
        height={height}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="shrink-0 overflow-visible drop-shadow-[0_8px_16px_rgba(14,116,144,0.22)] dark:drop-shadow-[0_0_16px_rgba(34,211,238,0.22)]"
      >
        <RobotArt uid={uid} variant={variant} mood={mood} look={gaze} />
      </svg>

      {message && (
        <div
          className="relative max-w-[17rem] rounded-2xl border border-[#CFE7EC] bg-white px-4 py-3 shadow-[0_10px_28px_-10px_rgba(14,116,144,0.35)] dark:border-[#1E4A54] dark:bg-[#0C1B21] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)]"
          style={isFull ? { marginTop: Math.round(height * 0.12) } : undefined}
        >
          <span
            aria-hidden="true"
            className={`absolute start-[-7px] h-3.5 w-3.5 rotate-45 border-b border-l border-[#CFE7EC] bg-white rtl:border-b-0 rtl:border-l-0 rtl:border-r rtl:border-t dark:border-[#1E4A54] dark:bg-[#0C1B21] ${
              isFull ? 'top-6' : 'top-1/2 -mt-[7px]'
            }`}
          />
          <div className="relative flex items-start gap-2">
            <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#0E7490] dark:text-[#22D3EE]" />
            <p dir="auto" className="text-[13.5px] font-semibold leading-relaxed text-[#0F2A2E] dark:text-[#E6F6F8]">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { RobotArt as RobotMascotArt, ROBOT_CSS as ROBOT_MASCOT_CSS };
export default RobotMascot;
