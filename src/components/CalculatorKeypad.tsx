import { useEffect, useRef } from 'react';
import { Check, Delete } from 'lucide-react';

interface CalculatorKeypadProps {
  value: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  compact?: boolean;
  submitLabel?: string;
}

export function CalculatorKeypad({
  value,
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
  disabled = false,
  compact = false,
  submitLabel = 'Sprawdź',
}: CalculatorKeypadProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        onClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (value.length > 0) {
          onSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onBackspace, onClear, onDigit, onSubmit, value.length]);

  // Wysokość klawiszy rośnie z ekranem: na małym iPhonie ~50 px, na większych do 64 px.
  const keyHeight = compact ? 'h-[clamp(48px,7.4svh,60px)]' : 'h-[clamp(52px,7.8svh,64px)]';

  const tap = () => {
    try {
      navigator.vibrate?.(8);
    } catch {
      // brak wibracji (np. iPhone) — bez znaczenia
    }
  };

  // Przytrzymanie „cofnij” czyści całą odpowiedź (zamiast osobnego przycisku obok zera).
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const startHold = () => {
    heldRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      tap();
      onClear();
    }, 550);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const base = `kp-key ${keyHeight} rounded-2xl border border-b-4 active:border-b-2 active:translate-y-[2px] active:scale-[0.97] transition-all duration-75 flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--th-primary)] [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]`;

  const numberBtnClass = `${base} bg-[var(--th-key-bg)] hover:bg-[var(--th-key-hover)] active:bg-[var(--th-key-hover)] border-[var(--th-key-border)] font-display text-[1.65rem] font-bold text-[var(--th-key-text)] tabular-nums`;

  const backBtnClass = `${base} font-semibold`;

  const rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
  ];

  return (
    <div
      className="kp w-full bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-2.5 sm:p-4 select-none"
      role="group"
      aria-label="Klawiatura kalkulatora"
    >
      {/* Większe odstępy między klawiszami = mniej trafień w sąsiedni przycisk. */}
      <div className="kp-grid grid grid-cols-3 gap-2.5 sm:gap-3">
        {rows.flat().map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => {
              tap();
              onDigit(digit);
            }}
            aria-label={`Cyfra ${digit}`}
            className={numberBtnClass}
          >
            {digit}
          </button>
        ))}

        {/* Zero na dwie kolumny — duży, łatwy cel. */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            tap();
            onDigit('0');
          }}
          aria-label="Cyfra 0"
          className={`${numberBtnClass} col-span-2`}
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled || value.length === 0}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (heldRef.current) {
              heldRef.current = false;
              return;
            }
            tap();
            onBackspace();
          }}
          aria-label="Cofnij ostatnią cyfrę (przytrzymaj, aby wyczyścić)"
          title="Cofnij — przytrzymaj, aby wyczyścić"
          className={backBtnClass}
          style={{
            background: 'color-mix(in oklab, #F59E0B 14%, var(--th-surface))',
            borderColor: 'color-mix(in oklab, #F59E0B 35%, var(--th-key-border))',
            color: 'color-mix(in oklab, #D97706 80%, var(--th-text))',
          }}
        >
          <Delete className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={onSubmit}
        className={`kp-submit mt-3.5 sm:mt-4 w-full ${
          compact ? 'h-[clamp(48px,7svh,56px)]' : 'h-14'
        } rounded-2xl [touch-action:manipulation] font-display text-base sm:text-lg font-bold tracking-wide flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--th-primary)] ${
          value.length > 0 && !disabled
            ? 'bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px]'
            : 'bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)] border-b-4 cursor-not-allowed opacity-70'
        }`}
      >
        <Check className="w-5 h-5" strokeWidth={2.8} aria-hidden="true" />
        <span>{submitLabel}</span>
      </button>
    </div>
  );
}
