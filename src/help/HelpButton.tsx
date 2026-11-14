import { HelpCircle } from 'lucide-react';
import type { HelpSectionId } from './helpContent';
import { useHelp } from './HelpContext';

/** Mała ikonka „?” otwierająca pomoc na właściwym rozdziale. */
export function HelpButton({
  section,
  label = 'Pomoc',
  className = '',
}: {
  section: HelpSectionId;
  label?: string;
  className?: string;
}) {
  const { openHelp } = useHelp();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openHelp(section);
      }}
      aria-label={`${label} — jak to działa?`}
      title="Jak to działa?"
      className={`inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full text-[var(--th-text-muted)] hover:text-[var(--th-primary)] cursor-pointer shrink-0 ${className}`}
    >
      <HelpCircle className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
