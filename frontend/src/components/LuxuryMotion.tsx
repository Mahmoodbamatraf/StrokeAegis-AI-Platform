import React, { useEffect, useRef, useState } from 'react';
export { ProgressOverlay, CtResultsSummaryOverlay } from './ProgressOverlay';
export type { ProgressOverlayProps, CtResultsSummaryOverlayProps } from './ProgressOverlay';

/* ============================================================================
 * 1. ANIMATED NUMBER COUNTER (Spring-eased rAF counter)
 * ========================================================================== */
interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  durationMs = 750,
  className = '',
}) => {
  const [displayVal, setDisplayVal] = useState(value);
  const prevValRef = useRef(0);

  useEffect(() => {
    const startVal = prevValRef.current;
    const endVal = value;
    prevValRef.current = value;

    let startTime: number | null = null;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayVal(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayVal(endVal);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return (
    <span className={`font-mono-tabular ${className}`}>
      {prefix}
      {displayVal.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/* ============================================================================
 * 2. INTERACTIVE 3D TILT & RADIAL SPOTLIGHT CARD
 * ========================================================================== */
interface SpotlightTiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltIntensity?: number;
  staggerIndex?: number;
  delayIndex?: number;
  accentGlow?: 'teal' | 'emerald' | 'amber' | 'crimson';
  glowColor?: 'teal' | 'emerald' | 'amber' | 'crimson';
}

export const SpotlightTiltCard: React.FC<SpotlightTiltCardProps> = ({
  children,
  className = '',
  tiltIntensity = 3.5,
  staggerIndex = 0,
  delayIndex,
  accentGlow = 'teal',
  glowColor,
}) => {
  const effectiveDelay = delayIndex ?? staggerIndex;
  const effectiveGlow = glowColor ?? accentGlow;
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50, active: false });

  const getThemeAwareTealGlow = () => {
    if (typeof document === 'undefined') return 'rgba(14, 116, 144, 0.16)';
    const acc = document.documentElement.getAttribute('data-accent');
    if (acc === 'surgical-emerald') return 'rgba(5, 150, 105, 0.18)';
    if (acc === 'royal-cyan') return 'rgba(37, 99, 235, 0.18)';
    return 'rgba(14, 116, 144, 0.16)';
  };

  const glowColorMap = {
    teal: getThemeAwareTealGlow(),
    emerald: 'rgba(4, 120, 87, 0.16)',
    amber: 'rgba(180, 83, 9, 0.16)',
    crimson: 'rgba(220, 38, 38, 0.16)',
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;

    if (tiltIntensity > 0) {
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * tiltIntensity;
      const rotateX = -((y - rect.height / 2) / (rect.height / 2)) * tiltIntensity;
      setTransformStyle(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`
      );
    }
    setSpotlightPos({ x: pctX, y: pctY, active: true });
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)');
    setSpotlightPos((p) => ({ ...p, active: false }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transformStyle,
        animationDelay: `${effectiveDelay * 55}ms`,
      }}
      className={`relative overflow-hidden transition-all duration-200 ease-out sa-luxury-enter ${className}`}
    >
      {/* Interactive Cursor Spotlight Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlightPos.active ? 1 : 0,
          background: `radial-gradient(380px circle at ${spotlightPos.x}% ${spotlightPos.y}%, ${glowColorMap[effectiveGlow]}, transparent 75%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

/* ============================================================================
 * 3. INTERACTIVE NEURAL SYNAPSE CANVAS BACKDROP
 * ========================================================================== */
export const NeuralCanvasBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = 640);
    const height = (canvas.height = 360);

    const nodes = Array.from({ length: 22 }, (_, i) => ({
      x: (Math.sin(i * 7.3) * 0.45 + 0.5) * width,
      y: (Math.cos(i * 3.9) * 0.45 + 0.5) * height,
      vx: (Math.cos(i * 2.1) || 0.5) * 0.35,
      vy: (Math.sin(i * 1.7) || 0.5) * 0.35,
      r: (i % 3) + 2,
    }));

    let tick = 0;
    const render = () => {
      tick += 0.025;
      ctx.clearRect(0, 0, width, height);

      const acc = document.documentElement.getAttribute('data-accent');
      const rgbStroke =
        acc === 'surgical-emerald'
          ? '5, 150, 105'
          : acc === 'royal-cyan'
            ? '37, 99, 235'
            : '14, 116, 144';
      const rgbNode =
        acc === 'surgical-emerald'
          ? '16, 185, 129'
          : acc === 'royal-cyan'
            ? '59, 130, 246'
            : '6, 182, 212';

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 12 || n.x > width - 12) n.vx *= -1;
        if (n.y < 12 || n.y > height - 12) n.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 135) {
            const alpha = (1 - dist / 135) * 0.25;
            ctx.strokeStyle = `rgba(${rgbStroke}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        const pulse = Math.sin(tick + i) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(${rgbNode}, ${0.38 + pulse * 0.45})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none w-full h-full object-cover opacity-75 dark:opacity-90 ${className}`}
    />
  );
};

/* ============================================================================
 * 4. LIVE CEREBROVASCULAR ECG / DOPPLER WAVEFORM SVG
 * ========================================================================== */
export const CerebrovascularWaveSvg: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 280 42"
      fill="none"
      aria-hidden="true"
      className={`w-40 h-8 overflow-visible ${className}`}
    >
      <path
        d="M 0 24 L 40 24 L 52 16 L 62 28 L 74 6 L 86 36 L 98 14 L 110 24 L 160 24 L 172 16 L 182 28 L 194 6 L 206 36 L 218 14 L 230 24 L 280 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sa-ecg-line text-[#0E7490] dark:text-[#22D3EE]"
      />
    </svg>
  );
};
