import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, MessageCircle, Share2 } from 'lucide-react';
import {
  buildVictoryShareText,
  renderVictoryPosterToCanvas,
  type VictoryPosterPayload,
} from '../engine/victoryCardCanvas';

interface VictoryPosterCardProps {
  payload: VictoryPosterPayload;
}

export function VictoryPosterCard({ payload }: VictoryPosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pngUrl, setPngUrl] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const shareText = useMemo(() => buildVictoryShareText(payload), [payload]);
  const whatsappHref = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    [shareText]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderVictoryPosterToCanvas(canvas, payload);
    try {
      setPngUrl(canvas.toDataURL('image/png'));
    } catch {
      // Ignore canvas serialization error in restricted environments
    }
  }, [payload]);

  const showNotice = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 2600);
  };

  const handleDownloadPng = () => {
    const url = pngUrl || canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    const safeName = payload.playerName.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    link.download = `mistrz-tabliczki-${safeName}-${payload.accuracyPct}pct.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Pobrano pamiątkową grafikę PNG!');
  };

  const handleNativeShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        if (blob) {
          const file = new File([blob], 'wynik-mistrz-tabliczki.png', {
            type: 'image/png',
          });
          if (
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: [file] })
          ) {
            await navigator.share({
              title: 'Mój wynik w Mistrzu Tabliczki!',
              text: shareText,
              files: [file],
            });
            showNotice('Udostępniono kartę wyniku!');
            return;
          }
        }
        await navigator.share({
          title: 'Mój wynik w Mistrzu Tabliczki!',
          text: shareText,
        });
        showNotice('Udostępniono wynik!');
        return;
      } catch {
        // Fall through to PNG download if user dismissed or platform blocked share
      }
    }

    handleDownloadPng();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      showNotice('Skopiowano opis wyniku do schowka!');
    } catch {
      showNotice('Gotowe — pobierz obrazek PNG lub kliknij WhatsApp.');
    }
  };

  return (
    <div
      className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-4"
      data-testid="victory-poster-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--th-text)]">
            Twoja Pamiątkowa Grafika Wyniku
          </h2>
          <p className="text-xs sm:text-sm text-[var(--th-text-muted)]">
            Pochwal się rodzinie lub znajomym — wyślij obrazek przez WhatsApp albo zapisz na pamiątkę.
          </p>
        </div>
        {statusMsg && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--th-primary)]">
            <Check className="w-4 h-4" aria-hidden="true" />
            {statusMsg}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Visual Generated Graphic Preview */}
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[270px] sm:max-w-[300px] rounded-2xl overflow-hidden border border-[var(--th-border)] shadow-md bg-slate-900">
            <canvas
              ref={canvasRef}
              aria-label={`Pamiątkowa karta wyniku dla ${payload.playerName}: ${payload.accuracyPct}% skuteczności, +${payload.pointsEarned} XP`}
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* Mobile-friendly Share & Download Actions */}
        <div className="md:col-span-7 space-y-3">
          <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--th-text-muted)] leading-relaxed">
            {shareText}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleNativeShare}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>Udostępnij grafikę</span>
            </button>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white border-b-4 border-[#166534] active:border-b-2 active:translate-y-[2px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Wyślij na WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--th-surface)] hover:opacity-90 border border-[var(--th-border)] text-[var(--th-text)] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
              <span>Pobierz obrazek PNG</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--th-surface)] hover:opacity-90 border border-[var(--th-border)] text-[var(--th-text)] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
              <span>Kopiuj opis wyniku</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
