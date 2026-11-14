/**
 * Certyfikat ukończenia (A4 poziomo) rysowany na canvasie — do druku, pobrania i udostępnienia.
 */

export type CertificateKind = 'stage' | 'tournament' | 'master';

export interface CertificateData {
  kind: CertificateKind;
  playerName: string;
  /** Np. „Złoty Finał 100”, „Wielki Finał Konkursowy”, „Wyzwanie Mistrza — poziom 4”. */
  title: string;
  /** Np. „Złoty Medal”, „Złoty Finalista”. */
  distinction?: string;
  accuracyPct?: number;
  totalTimeSec?: number;
  avgTimeSec?: number;
  tasks?: number;
  maxRange?: number;
  dateMs: number;
  primaryColor?: string;
  accentColor?: string;
}

export const CERT_W = 3508;
export const CERT_H = 2480;

const MEDAL_COLORS: Record<string, [string, string]> = {
  puchar: ['#FDE68A', '#B45309'],
  zloto: ['#FDE68A', '#B45309'],
  srebro: ['#F1F5F9', '#64748B'],
  braz: ['#FED7AA', '#9A3412'],
};

function certificateNumber(d: CertificateData): string {
  const raw = `${d.playerName}|${d.title}|${Math.floor(d.dateMs / 60000)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const date = new Date(d.dateMs);
  return `MT-${date.getFullYear()}-${(h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, font: (px: number) => string): number {
  let px = startPx;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxWidth && px > 40) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

export function achievementLine(d: CertificateData): string {
  if (d.kind === 'tournament') {
    return d.distinction
      ? `za zdobycie wyróżnienia „${d.distinction}” w turnieju`
      : 'za ukończenie turnieju';
  }
  if (d.kind === 'master') return 'za zaliczenie poziomu';
  return 'za ukończenie etapu Ścieżki Mistrza';
}

export function renderCertificate(canvas: HTMLCanvasElement, d: CertificateData): void {
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const primary = d.primaryColor || '#1D4ED8';
  const accent = d.accentColor || '#F59E0B';
  const gold = '#B8860B';
  const ink = '#1E293B';
  const muted = '#475569';
  const serif = (px: number, weight = 700) => `${weight} ${px}px Georgia, 'Times New Roman', serif`;
  const sans = (px: number, weight = 600) => `${weight} ${px}px 'Outfit', 'Inter', system-ui, sans-serif`;

  // Tło: kremowy papier z delikatnym gradientem
  const bg = ctx.createLinearGradient(0, 0, CERT_W, CERT_H);
  bg.addColorStop(0, '#FFFDF7');
  bg.addColorStop(1, '#FBF4E2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  // Narożne ornamenty (koła w kolorach motywu)
  const corner = (x: number, y: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 900);
    g.addColorStop(0, color + '33');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - 900, y - 900, 1800, 1800);
  };
  corner(0, 0, primary);
  corner(CERT_W, CERT_H, accent);

  // Podwójna ramka
  ctx.strokeStyle = gold;
  ctx.lineWidth = 18;
  ctx.strokeRect(110, 110, CERT_W - 220, CERT_H - 220);
  ctx.strokeStyle = primary;
  ctx.lineWidth = 6;
  ctx.strokeRect(160, 160, CERT_W - 320, CERT_H - 320);
  // Narożne gwiazdki
  ctx.fillStyle = gold;
  for (const [x, y] of [
    [160, 160],
    [CERT_W - 160, 160],
    [160, CERT_H - 160],
    [CERT_W - 160, CERT_H - 160],
  ]) {
    star(ctx, x, y, 46);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = CERT_W / 2;

  // Nagłówek
  ctx.fillStyle = primary;
  ctx.font = sans(70, 800);
  ctx.fillText('MISTRZ TABLICZKI', cx, 420);
  ctx.fillStyle = ink;
  ctx.font = serif(250, 700);
  ctx.fillText('CERTYFIKAT', cx, 700);
  // linia ozdobna
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 700, 780);
  ctx.lineTo(cx - 80, 780);
  ctx.moveTo(cx + 80, 780);
  ctx.lineTo(cx + 700, 780);
  ctx.stroke();
  ctx.fillStyle = gold;
  star(ctx, cx, 778, 40);
  ctx.fill();

  ctx.fillStyle = muted;
  ctx.font = sans(76, 500);
  ctx.fillText('przyznany dla', cx, 940);

  // Imię gracza
  ctx.fillStyle = ink;
  const namePx = fitText(ctx, d.playerName, CERT_W - 900, 230, (px) => serif(px, 700));
  ctx.font = serif(namePx, 700);
  ctx.fillText(d.playerName, cx, 1170);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 1050, 1230);
  ctx.lineTo(cx + 1050, 1230);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = sans(76, 500);
  ctx.fillText(achievementLine(d), cx, 1360);

  ctx.fillStyle = primary;
  const titlePx = fitText(ctx, `„${d.title}”`, CERT_W - 900, 140, (px) => serif(px, 700));
  ctx.font = serif(titlePx, 700);
  ctx.fillText(`„${d.title}”`, cx, 1530);

  // Wyniki
  const stats: { label: string; value: string }[] = [];
  if (typeof d.accuracyPct === 'number') stats.push({ label: 'Celność', value: `${d.accuracyPct}%` });
  if (typeof d.tasks === 'number') stats.push({ label: 'Zadania', value: `${d.tasks}` });
  if (typeof d.avgTimeSec === 'number')
    stats.push({ label: 'Tempo', value: `${d.avgTimeSec.toFixed(1).replace('.', ',')} s / zad.` });
  if (typeof d.totalTimeSec === 'number')
    stats.push({ label: 'Czas serii', value: `${Math.round(d.totalTimeSec)} s` });
  if (typeof d.maxRange === 'number') stats.push({ label: 'Zakres', value: `do ${d.maxRange}` });
  if (stats.length > 0) {
    const boxW = 470;
    const gap = 50;
    const totalW = stats.length * boxW + (stats.length - 1) * gap;
    let x = cx - totalW / 2;
    for (const st of stats) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 4;
      const r = 36;
      const y = 1590;
      const h = 230;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + boxW, y, x + boxW, y + h, r);
      ctx.arcTo(x + boxW, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + boxW, y, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = sans(50, 600);
      ctx.fillText(st.label, x + boxW / 2, y + 80);
      ctx.fillStyle = ink;
      const vPx = fitText(ctx, st.value, boxW - 40, 82, (px) => sans(px, 800));
      ctx.font = sans(vPx, 800);
      ctx.fillText(st.value, x + boxW / 2, y + 180);
      x += boxW + gap;
    }
  }

  // Pieczęć / medal po prawej
  const sealX = CERT_W - 560;
  const sealY = 2050;
  const [light, dark] =
    d.kind === 'tournament' && d.distinction
      ? MEDAL_COLORS[
          /puchar/i.test(d.distinction)
            ? 'puchar'
            : /złot/i.test(d.distinction)
            ? 'zloto'
            : /srebr/i.test(d.distinction)
            ? 'srebro'
            : /brąz/i.test(d.distinction)
            ? 'braz'
            : 'zloto'
        ]
      : ['#FDE68A', '#B45309'];
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(sealX - 110, sealY + 120);
  ctx.lineTo(sealX - 150, sealY + 280);
  ctx.lineTo(sealX - 80, sealY + 235);
  ctx.lineTo(sealX - 30, sealY + 290);
  ctx.lineTo(sealX, sealY + 140);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(sealX + 110, sealY + 120);
  ctx.lineTo(sealX + 150, sealY + 280);
  ctx.lineTo(sealX + 80, sealY + 235);
  ctx.lineTo(sealX + 30, sealY + 290);
  ctx.lineTo(sealX, sealY + 140);
  ctx.closePath();
  ctx.fill();
  const sg = ctx.createRadialGradient(sealX - 60, sealY - 60, 20, sealX, sealY, 220);
  sg.addColorStop(0, light);
  sg.addColorStop(1, dark);
  ctx.fillStyle = sg;
  star(ctx, sealX, sealY, 190, 16);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF55';
  ctx.beginPath();
  ctx.arc(sealX, sealY, 125, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  star(ctx, sealX, sealY, 80);
  ctx.fill();

  // Data, numer, podpis
  ctx.textAlign = 'left';
  const date = new Date(d.dateMs).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = ink;
  ctx.font = sans(64, 700);
  ctx.fillText(date, 420, 2080);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(420, 2110);
  ctx.lineTo(1250, 2110);
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.font = sans(46, 500);
  ctx.fillText('Data', 420, 2170);
  ctx.fillText(`Nr ${certificateNumber(d)}`, 420, 2240);

  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `italic 400 84px Georgia, 'Times New Roman', serif`;
  ctx.fillText('Mistrz Tabliczki', cx + 150, 2080);
  ctx.strokeStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(cx - 280, 2110);
  ctx.lineTo(cx + 580, 2110);
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.font = sans(46, 500);
  ctx.fillText('Trener mnożenia i dzielenia', cx + 150, 2170);
}

export function certificateFileName(d: CertificateData): string {
  const slug = `${d.playerName}-${d.title}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `certyfikat-${slug}.png`;
}
