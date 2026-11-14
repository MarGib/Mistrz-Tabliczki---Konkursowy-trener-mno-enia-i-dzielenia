import { useEffect } from 'react';
import { Check, Delete, RotateCcw } from 'lucide-react';

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

  const keyHeight = compact ? 'h-12 sm:h-13' : 'h-14 sm:h-15';

  const numberBtnClass = `${keyHeight} rounded-xl bg-[var(--th-key-bg)] hover:bg-[var(--th-key-hover)] border border-[var(--th-key-border)] border-b-4 active:border-b-2 active:translate-y-[2px] font-display text-2xl font-bold text-[var(--th-key-text)] tabular-nums transition-all duration-100 flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--th-primary)]`;

  const actionBtnClass = `${keyHeight} rounded-xl bg-[var(--th-surface-muted)] hover:opacity-90 border border-[var(--th-key-border)] border-b-4 active:border-b-2 active:translate-y-[2px] text-[var(--th-text-muted)] hover:text-[var(--th-text)] font-semibold transition-all duration-100 flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--th-primary)]`;

  const rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
  ];

  return (
    <div
      className="w-full bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3 sm:p-4 select-none"
      role="group"
      aria-label="Klawiatura kalkulatora"
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {rows.flat().map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(digit)}
            aria-label={`Cyfra ${digit}`}
            className={numberBtnClass}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          aria-label="Wyczyść odpowiedź"
          className={actionBtnClass}
        >
          <RotateCcw className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onDigit('0')}
          aria-label="Cyfra 0"
          className={numberBtnClass}
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label="Cofnij ostatnią cyfrę"
          className={actionBtnClass}
        >
          <Delete className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={onSubmit}
        className={`mt-2.5 sm:mt-3 w-full ${
          compact ? 'h-12' : 'h-14'
        } rounded-xl font-display text-base sm:text-lg font-bold tracking-wide flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--th-primary)] ${
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
