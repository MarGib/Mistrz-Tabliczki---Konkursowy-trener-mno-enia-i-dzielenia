import { Award, Download, Printer, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type CertificateData, certificateFileName, renderCertificate } from '../engine/certificateCanvas';

interface CertificateDialogProps {
  data: CertificateData;
  onClose: () => void;
}

/** Drukuje sam obrazek certyfikatu (reszta strony ukryta przez style @media print). */
export function printCertificateImage(dataUrl: string) {
  const old = document.getElementById('mt-print-cert');
  old?.remove();
  const holder = document.createElement('div');
  holder.id = 'mt-print-cert';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Certyfikat';
  holder.appendChild(img);
  document.body.appendChild(holder);
  const cleanup = () => {
    holder.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  const go = () => window.setTimeout(() => window.print(), 50);
  if (img.complete) go();
  else img.onload = go;
}

export function CertificateDialog({ data, onClose }: CertificateDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current ?? document.createElement('canvas');
    // poczekaj na czcionki, by tekst wyglądał jak w aplikacji
    const draw = () => {
      renderCertificate(c, data);
      try {
        setUrl(c.toDataURL('image/png'));
      } catch {
        setUrl('');
      }
    };
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
  }, [data]);

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = certificateFileName(data);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], certificateFileName(data), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Certyfikat — Mistrz Tabliczki',
          text: `${data.playerName}: ${data.title}`,
        });
        return;
      }
    } catch {
      // zamknięte menu udostępniania
      return;
    }
    download();
    setNote('To urządzenie nie udostępnia obrazków — certyfikat został pobrany.');
  };

  const btn =
    'min-h-[44px] px-4 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Certyfikat"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[var(--th-surface)] text-[var(--th-text)] rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold inline-flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" aria-hidden="true" />
            Certyfikat ukończenia
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-[var(--th-border)] inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {url ? (
          <img src={url} alt={`Certyfikat: ${data.title}`} className="w-full rounded-xl border border-[var(--th-border)] shadow-sm" />
        ) : (
          <div className="aspect-[1.414] w-full rounded-xl bg-[var(--th-surface-muted)] animate-pulse" />
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!url}
            onClick={() => printCertificateImage(url)}
            className={`${btn} bg-[var(--th-primary)] text-[var(--th-primary-fg)]`}
          >
            <Printer className="w-4 h-4" aria-hidden="true" /> Drukuj
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={download}
            className={`${btn} border border-[var(--th-border)]`}
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Pobierz
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={() => void share()}
            className={`${btn} border border-[var(--th-border)]`}
          >
            <Share2 className="w-4 h-4" aria-hidden="true" /> Udostępnij
          </button>
        </div>
        <p className="text-xs text-[var(--th-text-muted)]">
          Drukuj na kartce A4 ułożonej poziomo. Na telefonie możesz też wybrać „Zapisz jako PDF”.
        </p>
        {note && <p className="text-xs font-semibold text-[var(--th-primary)]">{note}</p>}
      </div>
    </div>
  );
}
