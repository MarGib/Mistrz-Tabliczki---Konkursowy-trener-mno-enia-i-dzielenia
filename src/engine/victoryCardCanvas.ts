import type { AvatarSpec } from '../types/math';

export interface VictoryPosterPayload {
  playerName: string;
  seriesTitle: string;
  accuracyPct: number;
  correctCount: number;
  totalTasks: number;
  totalTimeSec: number;
  avgTimeSec: number;
  pointsEarned: number;
  streakBest: number;
  passed: boolean;
  isStageOrTournament: boolean;
  badgeOrMedalTitle?: string;
  primaryColor: string;
  accentColor: string;
  avatarSpec?: AvatarSpec;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStarShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerR: number,
  innerR: number
) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

function drawMascotBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  spec?: AvatarSpec
) {
  const bg = spec?.bgColor ?? '#FEF3C7';
  const body = spec?.bodyColor ?? '#7C3AED';

  // Outer glow ring
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Friendly character illustration inside medal
  const char = spec?.character ?? 'owl';
  ctx.fillStyle = body;
  if (char === 'owl' || char === 'cat' || char === 'fox') {
    // Cute pointy ears
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.55, cy - radius * 0.25);
    ctx.lineTo(cx - radius * 0.35, cy - radius * 0.72);
    ctx.lineTo(cx - radius * 0.08, cy - radius * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.55, cy - radius * 0.25);
    ctx.lineTo(cx + radius * 0.35, cy - radius * 0.72);
    ctx.lineTo(cx + radius * 0.08, cy - radius * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (char === 'bear' || char === 'panda' || char === 'lion') {
    // Rounded ears
    ctx.beginPath();
    ctx.arc(cx - radius * 0.42, cy - radius * 0.36, radius * 0.2, 0, Math.PI * 2);
    ctx.arc(cx + radius * 0.42, cy - radius * 0.36, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (char === 'rabbit') {
    // Tall bunny ears
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.26, cy - radius * 0.62, radius * 0.13, radius * 0.32, -0.15, 0, Math.PI * 2);
    ctx.ellipse(cx + radius * 0.26, cy - radius * 0.62, radius * 0.13, radius * 0.32, 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (char === 'dragon') {
    // Dragon horns in contrast amber/gold
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.38, cy - radius * 0.32);
    ctx.lineTo(cx - radius * 0.5, cy - radius * 0.74);
    ctx.lineTo(cx - radius * 0.16, cy - radius * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.38, cy - radius * 0.32);
    ctx.lineTo(cx + radius * 0.5, cy - radius * 0.74);
    ctx.lineTo(cx + radius * 0.16, cy - radius * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
  } else if (char === 'robot') {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.48);
    ctx.lineTo(cx, cy - radius * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.75, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
  }

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy + 6, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Panda eye patches
  if (char === 'panda') {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.2, cy - 2, radius * 0.21, 0, Math.PI * 2);
    ctx.arc(cx + radius * 0.2, cy - 2, radius * 0.21, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.2, cy - 2, radius * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + radius * 0.2, cy - 2, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.2, cy - 2, radius * 0.075, 0, Math.PI * 2);
  ctx.arc(cx + radius * 0.2, cy - 2, radius * 0.075, 0, Math.PI * 2);
  ctx.fill();

  // Glasses accessory
  if (spec?.accessory === 'glasses') {
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx - radius * 0.2, cy - 2, radius * 0.19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + radius * 0.2, cy - 2, radius * 0.19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.02, cy - 2);
    ctx.lineTo(cx + radius * 0.02, cy - 2);
    ctx.stroke();
  }

  // Beak or happy smile
  if (char === 'owl' || char === 'penguin') {
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 8);
    ctx.lineTo(cx + 10, cy + 8);
    ctx.lineTo(cx, cy + 22);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 10, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Crown on top for victory card
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - radius * 0.46);
  ctx.lineTo(cx - 18, cy - radius * 0.78);
  ctx.lineTo(cx - 7, cy - radius * 0.58);
  ctx.lineTo(cx, cy - radius * 0.85);
  ctx.lineTo(cx + 7, cy - radius * 0.58);
  ctx.lineTo(cx + 18, cy - radius * 0.78);
  ctx.lineTo(cx + 24, cy - radius * 0.46);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function renderVictoryPosterToCanvas(
  canvas: HTMLCanvasElement,
  payload: VictoryPosterPayload
): void {
  const width = 900;
  const height = 1125;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Vibrant gradient background using active theme primary & deep indigo/slate harmony
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, payload.primaryColor);
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative background circles & confetti stars
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(110, 140, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(820, 960, 230, 0, Math.PI * 2);
  ctx.fill();

  const starCoords = [
    [130, 290, 18],
    [770, 210, 22],
    [740, 420, 14],
    [160, 460, 14],
    [810, 740, 16],
    [95, 810, 18],
  ];
  ctx.fillStyle = payload.accentColor;
  for (const [sx, sy, sr] of starCoords) {
    ctx.globalAlpha = 0.85;
    drawStarShape(ctx, sx, sy, 5, sr, sr * 0.45);
  }
  ctx.restore();

  // 2. Top Header Banner
  ctx.fillStyle = payload.accentColor;
  drawRoundedRect(ctx, 240, 56, 420, 48, 24);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 22px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    payload.passed ? 'WYZWANIE ZALICZONE!' : 'RAPORT TRENINGU',
    width / 2,
    80
  );

  // 3. Mascot / Avatar Medallion
  drawMascotBadge(ctx, width / 2, 228, 86, payload.avatarSpec);

  // 4. Player Name & Series Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 50px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.fillText(`Brawo, ${payload.playerName}!`, width / 2, 372);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '600 26px Plus Jakarta Sans, sans-serif';
  const titleText =
    payload.seriesTitle.length > 42
      ? `${payload.seriesTitle.slice(0, 40)}...`
      : payload.seriesTitle;
  ctx.fillText(titleText, width / 2, 424);

  if (payload.badgeOrMedalTitle) {
    ctx.fillStyle = payload.accentColor;
    ctx.font = '700 24px Outfit, sans-serif';
    ctx.fillText(`Zdobyto: ${payload.badgeOrMedalTitle}`, width / 2, 468);
  }

  // 5. Crisp White Stats Sheet Card
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, 64, 510, width - 128, 490, 36);
  ctx.fill();
  ctx.restore();

  const stats = [
    {
      label: 'SKUTECZNOŚĆ',
      value: `${payload.accuracyPct}%`,
      sub: `${payload.correctCount} z ${payload.totalTasks} zadań`,
    },
    {
      label: 'ZDOBYTE PUNKTY',
      value: `+${payload.pointsEarned} XP`,
      sub: `Najlepsza passa: ${payload.streakBest}×`,
    },
    {
      label: 'CZAS CAŁEJ SERII',
      value: `${payload.totalTimeSec.toFixed(1).replace('.', ',')} s`,
      sub: 'Łączny czas gry',
    },
    {
      label: 'ŚREDNIO NA ZADANIE',
      value: `${payload.avgTimeSec.toFixed(1).replace('.', ',')} s`,
      sub: payload.avgTimeSec <= 2.8 ? 'Tempo na wyrywki!' : 'Coraz szybciej!',
    },
  ];

  const cardW = 352;
  const cardH = 192;
  const startX = 94;
  const startY = 548;
  const gap = 24;

  stats.forEach((st, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    ctx.fillStyle = '#F8FAFC';
    drawRoundedRect(ctx, x, y, cardW, cardH, 24);
    ctx.fill();

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '700 18px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(st.label, x + 28, y + 44);

    ctx.fillStyle = idx === 1 ? payload.primaryColor : '#0F172A';
    ctx.font = '800 54px Outfit, sans-serif';
    ctx.fillText(st.value, x + 28, y + 110);

    ctx.fillStyle = '#475569';
    ctx.font = '600 20px Plus Jakarta Sans, sans-serif';
    ctx.fillText(st.sub, x + 28, y + 158);
  });

  // 6. Footer Branding
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '700 22px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Mistrz Tabliczki · Konkursowy Trener Matematyczny', width / 2, 1062);
}

export function buildVictoryShareText(payload: VictoryPosterPayload): string {
  const badgeLine = payload.badgeOrMedalTitle
    ? ` 🏆 Zdobyto: ${payload.badgeOrMedalTitle}!`
    : '';
  return `${payload.playerName} ukończył(a) „${payload.seriesTitle}” w Mistrzu Tabliczki! Wynik: ${payload.accuracyPct}% (${payload.correctCount}/${payload.totalTasks}), czas: ${payload.totalTimeSec.toFixed(1).replace('.', ',')} s (śr. ${payload.avgTimeSec.toFixed(1).replace('.', ',')} s/zadanie), zdobyto +${payload.pointsEarned} XP.${badgeLine}`;
}
