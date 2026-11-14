import { useMemo, useState } from 'react';
import { Check, Palette, Plus, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { PRESET_THEMES } from '../data/themes';
import {
  buildThemeTokens,
  createColorTheme,
  getContrastRatio,
} from '../engine/themeEngine';
import type { ColorTheme, ThemePaletteInput } from '../types/math';

interface ThemesViewProps {
  activeProfileName?: string;
  activeThemeId: string;
  customThemes: ColorTheme[];
  onSelectTheme: (themeId: string) => void;
  onSaveCustomTheme: (theme: ColorTheme) => void;
  onDeleteCustomTheme: (themeId: string) => void;
}

const PRIMARY_SWATCHES = [
  { label: 'Royal Purple', hex: '#7C3AED' },
  { label: 'Chicago Bulls', hex: '#CE1141' },
  { label: 'Niebieski', hex: '#1D4ED8' },
  { label: 'Szmaragdowy', hex: '#16A34A' },
  { label: 'Koralowy', hex: '#EA580C' },
  { label: 'Malinowy', hex: '#BE185D' },
];

const ACCENT_SWATCHES = [
  { label: 'Ostry Żółty', hex: '#FACC15' },
  { label: 'Czerń Onyx', hex: '#111827' },
  { label: 'Turkus', hex: '#06B6D4' },
  { label: 'Złoty', hex: '#F59E0B' },
  { label: 'Miętowy', hex: '#10B981' },
  { label: 'Fioletowy', hex: '#A855F7' },
];

const RANDOM_HARMONIES: { name: string; palette: ThemePaletteInput }[] = [
  {
    name: 'Fioletowy Piorun',
    palette: {
      canvas: '#F5F3FF',
      surface: '#FFFFFF',
      primary: '#6D28D9',
      accent: '#FACC15',
      isDark: false,
    },
  },
  {
    name: 'Arktyczny Błękit',
    palette: {
      canvas: '#ECFEFF',
      surface: '#FFFFFF',
      primary: '#0284C7',
      accent: '#F59E0B',
      isDark: false,
    },
  },
  {
    name: 'Nocny Tygrys',
    palette: {
      canvas: '#0F172A',
      surface: '#1E293B',
      primary: '#F59E0B',
      accent: '#38BDF8',
      isDark: true,
    },
  },
  {
    name: 'Limonkowy Sprint',
    palette: {
      canvas: '#F7FEE7',
      surface: '#FFFFFF',
      primary: '#15803D',
      accent: '#EC4899',
      isDark: false,
    },
  },
];

export function ThemesView({
  activeProfileName,
  activeThemeId,
  customThemes,
  onSelectTheme,
  onSaveCustomTheme,
  onDeleteCustomTheme,
}: ThemesViewProps) {
  const [customName, setCustomName] = useState('Mój Własny Szablon');
  const [isDark, setIsDark] = useState(false);
  const [canvasColor, setCanvasColor] = useState('#F4F0FF');
  const [surfaceColor, setSurfaceColor] = useState('#FFFFFF');
  const [primaryColor, setPrimaryColor] = useState('#7C3AED');
  const [accentColor, setAccentColor] = useState('#FACC15');
  const [savedNotice, setSavedNotice] = useState(false);

  const previewTokens = useMemo(
    () =>
      buildThemeTokens({
        canvas: canvasColor,
        surface: surfaceColor,
        primary: primaryColor,
        accent: accentColor,
        isDark,
      }),
    [accentColor, canvasColor, isDark, primaryColor, surfaceColor]
  );

  const primaryContrast = getContrastRatio(
    previewTokens.primary,
    previewTokens.primaryFg
  );
  const textContrast = getContrastRatio(
    previewTokens.surface,
    previewTokens.text
  );
  const isContrastGood = primaryContrast >= 4.5 && textContrast >= 4.5;

  const handleToggleMode = (dark: boolean) => {
    setIsDark(dark);
    if (dark) {
      setCanvasColor('#0B1120');
      setSurfaceColor('#131C31');
    } else {
      setCanvasColor('#F7F9FC');
      setSurfaceColor('#FFFFFF');
    }
  };

  const handleRandomize = () => {
    const pick =
      RANDOM_HARMONIES[Math.floor(Math.random() * RANDOM_HARMONIES.length)];
    setCustomName(pick.name);
    setIsDark(pick.palette.isDark);
    setCanvasColor(pick.palette.canvas);
    setSurfaceColor(pick.palette.surface);
    setPrimaryColor(pick.palette.primary);
    setAccentColor(pick.palette.accent);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `custom-${Date.now()}`;
    const created = createColorTheme(
      id,
      customName.trim() || 'Mój Szablon',
      'Własny szablon stworzony w kreatorze kolorów.',
      {
        canvas: canvasColor,
        surface: surfaceColor,
        primary: primaryColor,
        accent: accentColor,
        isDark,
      },
      true
    );
    onSaveCustomTheme(created);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  const allThemes = [...PRESET_THEMES, ...customThemes];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)]">
          Szablony Kolorystyczne{activeProfileName ? ` · Profil: ${activeProfileName}` : ''}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-[var(--th-text-muted)]">
          Każdy członek rodziny może wybrać swój ulubiony motyw (m.in. Royal Purple, Chicago Bulls, Błękit Oceanu) lub stworzyć własny w kreatorze poniżej.
        </p>
      </div>

      {/* Themes Gallery */}
      <section aria-labelledby="gallery-heading">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2
            id="gallery-heading"
            className="font-display text-xl font-bold text-[var(--th-text)]"
          >
            Dostępne szablony ({allThemes.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allThemes.map((theme) => {
            const isActive = theme.id === activeThemeId;
            const t = theme.tokens;

            return (
              <div
                key={theme.id}
                data-testid={`theme-card-${theme.id}`}
                style={{
                  backgroundColor: t.surface,
                  borderColor: isActive ? t.primary : t.border,
                  color: t.text,
                }}
                className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                  isActive ? 'ring-2 ring-offset-2' : 'hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Mini Visual Swatch Header */}
                  <div
                    style={{
                      backgroundColor: t.canvas,
                      borderColor: t.border,
                    }}
                    className="rounded-xl border p-3 mb-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-6 h-6 rounded-lg border border-black/10"
                        style={{ backgroundColor: t.primary }}
                        title="Kolor dominujący"
                      />
                      <span
                        className="w-6 h-6 rounded-lg border border-black/10"
                        style={{ backgroundColor: t.accent }}
                        title="Kolor kontrastowy"
                      />
                      <span
                        className="w-6 h-6 rounded-lg border border-black/10"
                        style={{ backgroundColor: t.surface }}
                        title="Kolor kart"
                      />
                    </div>
                    <span
                      style={{
                        backgroundColor: t.primary,
                        color: t.primaryFg,
                      }}
                      className="px-2.5 py-1 rounded-lg font-display text-xs font-bold tabular-nums"
                    >
                      7 × 8
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold">
                      {theme.name}
                    </h3>
                    {theme.isCustom && (
                      <button
                        type="button"
                        onClick={() => onDeleteCustomTheme(theme.id)}
                        aria-label={`Usuń własny szablon ${theme.name}`}
                        className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p
                    style={{ color: t.textMuted }}
                    className="mt-1 text-xs leading-snug"
                  >
                    {theme.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTheme(theme.id)}
                  style={
                    isActive
                      ? {
                          backgroundColor: t.primary,
                          color: t.primaryFg,
                          borderBottomColor: t.primaryDark,
                        }
                      : {
                          backgroundColor: t.surfaceMuted,
                          color: t.text,
                          borderColor: t.border,
                        }
                  }
                  className={`mt-4 w-full min-h-[42px] px-3 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isActive ? 'border-b-4' : 'border hover:opacity-90'
                  }`}
                >
                  {isActive && <Check className="w-4 h-4" aria-hidden="true" />}
                  <span>{isActive ? 'Aktywny szablon' : 'Wybierz szablon'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom Theme Creator */}
      <section
        aria-labelledby="creator-heading"
        className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--th-border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] text-[var(--th-primary)] flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="creator-heading"
                className="font-display text-xl sm:text-2xl font-bold text-[var(--th-text)]"
              >
                Kreator Własnego Szablonu
              </h2>
              <p className="text-sm text-[var(--th-text-muted)]">
                Skomponuj swój własny styl kolorystyczny i sprawdź na żywo, jak prezentują się zadania.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomize}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] text-[var(--th-text)] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer shrink-0"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
            <span>Losuj paletę</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Controls */}
          <form onSubmit={handleSaveCustom} className="lg:col-span-6 space-y-5">
            <div>
              <label
                htmlFor="custom-theme-name"
                className="block text-sm font-bold text-[var(--th-text)] mb-1.5"
              >
                Nazwa Twojego szablonu
              </label>
              <input
                id="custom-theme-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={28}
                placeholder="np. Mój Złoty Fiolet"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] font-semibold focus:outline-2 focus:outline-[var(--th-primary)]"
              />
            </div>

            {/* Light / Dark Mode Switch */}
            <div>
              <span className="block text-sm font-bold text-[var(--th-text)] mb-1.5">
                Styl tła aplikacji
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--th-surface-muted)] rounded-xl border border-[var(--th-border)]">
                <button
                  type="button"
                  onClick={() => handleToggleMode(false)}
                  className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                    !isDark
                      ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                      : 'text-[var(--th-text-muted)]'
                  }`}
                >
                  Jasny motyw
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                      : 'text-[var(--th-text-muted)]'
                  }`}
                >
                  Ciemny motyw
                </button>
              </div>
            </div>

            {/* Primary Dominant Color */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="picker-primary"
                  className="text-sm font-bold text-[var(--th-text)]"
                >
                  Kolor dominujący (główny)
                </label>
                <span className="font-mono text-xs text-[var(--th-text-muted)] tabular-nums">
                  {primaryColor}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="picker-primary"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-11 h-11 rounded-xl border border-[var(--th-border)] cursor-pointer bg-transparent p-0.5"
                />
                {PRIMARY_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => setPrimaryColor(sw.hex)}
                    title={sw.label}
                    aria-label={`Ustaw kolor główny: ${sw.label}`}
                    style={{ backgroundColor: sw.hex }}
                    className={`w-9 h-9 rounded-xl border-2 cursor-pointer transition-transform ${
                      primaryColor.toUpperCase() === sw.hex
                        ? 'border-[var(--th-text)] scale-110'
                        : 'border-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Contrast Accent Color */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="picker-accent"
                  className="text-sm font-bold text-[var(--th-text)]"
                >
                  Kolor kontrastowy (akcenty i wyróżnienia)
                </label>
                <span className="font-mono text-xs text-[var(--th-text-muted)] tabular-nums">
                  {accentColor}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="picker-accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-11 h-11 rounded-xl border border-[var(--th-border)] cursor-pointer bg-transparent p-0.5"
                />
                {ACCENT_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => setAccentColor(sw.hex)}
                    title={sw.label}
                    aria-label={`Ustaw kolor kontrastowy: ${sw.label}`}
                    style={{ backgroundColor: sw.hex }}
                    className={`w-9 h-9 rounded-xl border-2 cursor-pointer transition-transform ${
                      accentColor.toUpperCase() === sw.hex
                        ? 'border-[var(--th-text)] scale-110'
                        : 'border-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Canvas & Surface Fine-Tuning */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-xl p-3">
                <label
                  htmlFor="picker-canvas"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1.5"
                >
                  Tło ekranu
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="picker-canvas"
                    type="color"
                    value={canvasColor}
                    onChange={(e) => setCanvasColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-[var(--th-border)] cursor-pointer"
                  />
                  <span className="font-mono text-xs text-[var(--th-text-muted)]">
                    {canvasColor}
                  </span>
                </div>
              </div>

              <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-xl p-3">
                <label
                  htmlFor="picker-surface"
                  className="block text-xs font-bold text-[var(--th-text)] mb-1.5"
                >
                  Tło kart
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="picker-surface"
                    type="color"
                    value={surfaceColor}
                    onChange={(e) => setSurfaceColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-[var(--th-border)] cursor-pointer"
                  />
                  <span className="font-mono text-xs text-[var(--th-text-muted)]">
                    {surfaceColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display font-bold text-sm sm:text-base border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Zapisz i użyj szablonu</span>
              </button>

              {savedNotice && (
                <span className="text-xs sm:text-sm font-bold text-[var(--th-primary)]">
                  Zapisano i aktywowano nowy szablon!
                </span>
              )}
            </div>
          </form>

          {/* Right: Live Interactive Preview */}
          <div className="lg:col-span-6">
            <div
              data-testid="theme-live-preview"
              style={{
                backgroundColor: previewTokens.canvas,
                borderColor: previewTokens.border,
                color: previewTokens.text,
              }}
              className="rounded-3xl border p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span style={{ color: previewTokens.textMuted }}>
                  Podgląd na żywo · {customName || 'Mój Szablon'}
                </span>
                <span
                  style={{
                    color: isContrastGood ? previewTokens.primary : '#DC2626',
                  }}
                  className="font-bold tabular-nums"
                >
                  {isContrastGood
                    ? `Kontrast czytelny (${primaryContrast}:1)`
                    : `Niski kontrast (${primaryContrast}:1)`}
                </span>
              </div>

              {/* Mini Equation Card */}
              <div
                style={{
                  backgroundColor: previewTokens.surface,
                  borderColor: previewTokens.border,
                }}
                className="rounded-2xl border p-5 space-y-4"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span style={{ color: previewTokens.textMuted }}>
                    Mnożenie · Zakres do 100
                  </span>
                  <span
                    style={{
                      backgroundColor: previewTokens.accent,
                      color: previewTokens.accentFg,
                    }}
                    className="px-2.5 py-0.5 rounded-lg font-bold inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    Seria 5×
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 py-2">
                  <span className="font-display text-3xl font-extrabold tabular-nums">
                    7 × 8 =
                  </span>
                  <span
                    style={{
                      backgroundColor: previewTokens.softTint,
                      borderColor: previewTokens.primary,
                      color: previewTokens.text,
                    }}
                    className="px-4 py-1.5 rounded-xl border-2 font-display text-3xl font-extrabold tabular-nums"
                  >
                    56
                  </span>
                </div>

                {/* Mini Keypad Row + Primary CTA */}
                <div className="grid grid-cols-3 gap-2">
                  {['7', '8', '9'].map((d) => (
                    <div
                      key={d}
                      style={{
                        backgroundColor: previewTokens.keyBg,
                        borderColor: previewTokens.keyBorder,
                        color: previewTokens.keyText,
                      }}
                      className="h-10 rounded-xl border border-b-4 font-display font-bold flex items-center justify-center tabular-nums"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    backgroundColor: previewTokens.primary,
                    color: previewTokens.primaryFg,
                    borderBottomColor: previewTokens.primaryDark,
                  }}
                  className="h-11 rounded-xl border-b-4 font-display font-bold text-sm flex items-center justify-center"
                >
                  Sprawdź odpowiedź
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
