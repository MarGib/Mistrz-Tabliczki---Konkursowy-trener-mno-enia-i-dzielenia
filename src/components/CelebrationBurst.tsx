import { useEffect, useRef } from 'react';
import { Sparkles, Star } from 'lucide-react';

interface CelebrationBurstProps {
  triggerKey: number;
  variant: 'correct' | 'grand';
  label?: string;
  streak?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  life: number;
  maxLife: number;
  shape: 'star' | 'confetti' | 'circle';
}

const BURST_COLORS = [
  '#FACC15', // Sun yellow
  '#10B981', // Emerald
  '#38BDF8', // Sky blue
  '#A855F7', // Royal purple
  '#F97316', // Orange
  '#EC4899', // Pink
];

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

export function CelebrationBurst({
  triggerKey,
  variant,
  label,
  streak = 0,
}: CelebrationBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (triggerKey === 0) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = variant === 'grand' ? 68 : streak >= 3 ? 42 : 28;
    const originX = width * 0.5;
    const originY = variant === 'grand' ? height * 0.28 : height * 0.52;

    const particles: Particle[] = Array.from({ length: count }).map((_, i) => {
      const angle =
        variant === 'grand'
          ? (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
          : -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
      const speed =
        (variant === 'grand' ? 3.5 : 2.8) + Math.random() * (variant === 'grand' ? 5.5 : 4.2);
      const shapes: Particle['shape'][] = ['star', 'confetti', 'circle'];
      return {
        x: originX + (Math.random() - 0.5) * 32,
        y: originY + (Math.random() - 0.5) * 18,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (variant === 'grand' ? 1.5 : 1.0),
        size: 5 + Math.random() * 6,
        color: BURST_COLORS[i % BURST_COLORS.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.24,
        life: 0,
        maxLife: variant === 'grand' ? 65 + Math.random() * 25 : 42 + Math.random() * 14,
        shape: shapes[i % shapes.length],
      };
    });

    let rafId = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = false;

      for (const p of particles) {
        p.life += 1;
        if (p.life >= p.maxLife) continue;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // gentle gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          drawStar(ctx, 0, 0, 5, p.size * 0.72, p.size * 0.34);
        } else if (p.shape === 'confetti') {
          ctx.fillRect(-p.size * 0.55, -p.size * 0.28, p.size * 1.1, p.size * 0.56);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive) {
        rafId = window.requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [triggerKey, variant, streak]);

  if (triggerKey === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-20 flex items-start justify-center"
      data-testid="celebration-burst"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {label && variant !== 'grand' && (
        <div
          key={triggerKey}
          className="animate-pop-in absolute top-[46px] sm:top-[56px] left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl bg-[var(--th-accent)] text-[var(--th-accent-fg)] border border-black/10 shadow-sm font-display text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          {streak >= 3 ? (
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Star className="w-3.5 h-3.5 fill-current shrink-0" />
          )}
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
