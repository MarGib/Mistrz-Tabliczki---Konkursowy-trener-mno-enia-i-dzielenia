import type { ColorTheme, ThemePaletteInput, ThemeTokens } from '../types/math';

function normalizeHex(hex: string): string {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return (
      '#' +
      cleaned
        .split('')
        .map((ch) => ch + ch)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return '#' + cleaned.toUpperCase();
  }
  return '#2563EB';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const full = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const t = Math.max(0, Math.min(1, weightB));
  return rgbToHex(
    a.r * (1 - t) + b.r * t,
    a.g * (1 - t) + b.g * t,
    a.b * (1 - t) + b.b * t
  );
}

export function darkenHex(hex: string, amount: number): string {
  return mixHex(hex, '#000000', amount);
}

export function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, '#FFFFFF', amount);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const bright = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

export function getReadableForeground(bgHex: string): string {
  const darkText = '#0F172A';
  const lightText = '#FFFFFF';
  return getContrastRatio(bgHex, darkText) >= getContrastRatio(bgHex, lightText)
    ? darkText
    : lightText;
}

export function buildThemeTokens(input: ThemePaletteInput): ThemeTokens {
  const canvas = normalizeHex(input.canvas);
  const surface = normalizeHex(input.surface);
  const primary = normalizeHex(input.primary);
  const accent = normalizeHex(input.accent);
  const isDark = input.isDark;

  const text = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#475569';
  const surfaceMuted = isDark
    ? lightenHex(surface, 0.08)
    : mixHex(canvas, primary, 0.06);
  const border = isDark
    ? lightenHex(surface, 0.16)
    : mixHex('#E2E8F0', primary, 0.14);

  const primaryHover = isDark ? lightenHex(primary, 0.1) : lightenHex(primary, 0.08);
  const primaryDark = darkenHex(primary, 0.28);
  const primaryFg = getReadableForeground(primary);

  const accentHover = lightenHex(accent, 0.08);
  const accentDark = darkenHex(accent, 0.24);
  const accentFg = getReadableForeground(accent);

  const softTint = isDark
    ? mixHex(surface, primary, 0.2)
    : mixHex('#FFFFFF', primary, 0.09);
  const softTintBorder = isDark
    ? mixHex(surface, primary, 0.42)
    : mixHex('#FFFFFF', primary, 0.28);

  const keyBg = isDark ? lightenHex(surface, 0.06) : '#FFFFFF';
  const keyHover = isDark ? lightenHex(surface, 0.12) : mixHex('#FFFFFF', primary, 0.05);
  const keyBorder = isDark ? lightenHex(surface, 0.22) : mixHex('#CBD5E1', primary, 0.18);
  const keyText = text;

  return {
    canvas,
    surface,
    primary,
    accent,
    isDark,
    surfaceMuted,
    border,
    text,
    textMuted,
    primaryHover,
    primaryDark,
    primaryFg,
    accentHover,
    accentDark,
    accentFg,
    softTint,
    softTintBorder,
    keyBg,
    keyHover,
    keyBorder,
    keyText,
  };
}

export function createColorTheme(
  id: string,
  name: string,
  description: string,
  palette: ThemePaletteInput,
  isCustom = false
): ColorTheme {
  return {
    id,
    name,
    description,
    isCustom,
    palette,
    tokens: buildThemeTokens(palette),
  };
}

export function themeToCssVariables(theme: ColorTheme): Record<string, string> {
  const t = theme.tokens;
  return {
    '--th-canvas': t.canvas,
    '--th-surface': t.surface,
    '--th-surface-muted': t.surfaceMuted,
    '--th-border': t.border,
    '--th-text': t.text,
    '--th-text-muted': t.textMuted,
    '--th-primary': t.primary,
    '--th-primary-hover': t.primaryHover,
    '--th-primary-dark': t.primaryDark,
    '--th-primary-fg': t.primaryFg,
    '--th-accent': t.accent,
    '--th-accent-hover': t.accentHover,
    '--th-accent-dark': t.accentDark,
    '--th-accent-fg': t.accentFg,
    '--th-soft-tint': t.softTint,
    '--th-soft-tint-border': t.softTintBorder,
    '--th-key-bg': t.keyBg,
    '--th-key-hover': t.keyHover,
    '--th-key-border': t.keyBorder,
    '--th-key-text': t.keyText,
  };
}
