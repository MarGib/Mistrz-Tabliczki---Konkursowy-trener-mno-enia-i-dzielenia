import { createColorTheme } from '../engine/themeEngine';
import type { ColorTheme } from '../types/math';

export const DEFAULT_THEME_ID = 'szmaragdowe-studio';

export const PRESET_THEMES: ColorTheme[] = [
  createColorTheme(
    'szmaragdowe-studio',
    'Szmaragdowe Studio',
    'Klasyczny jasny motyw edukacyjny z wyrazistą zielenią mistrzów i słonecznym bursztynem.',
    {
      canvas: '#F7F9FC',
      surface: '#FFFFFF',
      primary: '#16A34A',
      accent: '#F59E0B',
      isDark: false,
    }
  ),
  createColorTheme(
    'royal-purple',
    'Royal Purple',
    'Dominujący królewski fiolet z ostrymi, energetycznymi akcentami w słonecznym żółtym kolorze.',
    {
      canvas: '#F4F0FF',
      surface: '#FFFFFF',
      primary: '#7C3AED',
      accent: '#FACC15',
      isDark: false,
    }
  ),
  createColorTheme(
    'chicago-bulls',
    'Chicago Bulls',
    'Dynamiczna czerwień parkietu NBA połączona z głęboką czernią i czystą bielą.',
    {
      canvas: '#F8F5F5',
      surface: '#FFFFFF',
      primary: '#CE1141',
      accent: '#111827',
      isDark: false,
    }
  ),
  createColorTheme(
    'blekit-oceanu',
    'Błękit Oceanu',
    'Królewski niebieski kolor przewodni na chłodnym niebiańskim tle z turkusowymi błyskami.',
    {
      canvas: '#EFF6FF',
      surface: '#FFFFFF',
      primary: '#1D4ED8',
      accent: '#06B6D4',
      isDark: false,
    }
  ),
  createColorTheme(
    'nocny-kosmos',
    'Nocny Kosmos',
    'Ciemny tryb gwiezdny z jasnym błękitem i kontrastowym złotem gwiazd.',
    {
      canvas: '#0B1120',
      surface: '#131C31',
      primary: '#38BDF8',
      accent: '#FBBF24',
      isDark: true,
    }
  ),
  createColorTheme(
    'lesny-mech',
    'Leśny Mech',
    'Spokojna zieleń sosnowa z ciepłym miodowym akcentem do długiej, skupionej nauki.',
    {
      canvas: '#F0FDF4',
      surface: '#FFFFFF',
      primary: '#15803D',
      accent: '#D97706',
      isDark: false,
    }
  ),
  createColorTheme(
    'sloneczny-bursztyn',
    'Słoneczny Bursztyn',
    'Ciepła złota energia z głębokim granatem indygo zapewniającym mocny kontrast.',
    {
      canvas: '#FFFBEB',
      surface: '#FFFFFF',
      primary: '#D97706',
      accent: '#3730A3',
      isDark: false,
    }
  ),
  createColorTheme(
    'koralowa-rafa',
    'Koralowa Rafa',
    'Żywy koralowy pomarańcz zestawiony z głębokim morskim turkusem.',
    {
      canvas: '#FFF7ED',
      surface: '#FFFFFF',
      primary: '#EA580C',
      accent: '#0F766E',
      isDark: false,
    }
  ),
  createColorTheme(
    'malinowy-sprint',
    'Malinowy Sprint',
    'Wyrazista malinowa paleta z kontrastową miętową zielenią do szybkich wyścigów.',
    {
      canvas: '#FDF2F8',
      surface: '#FFFFFF',
      primary: '#BE185D',
      accent: '#059669',
      isDark: false,
    }
  ),
  createColorTheme(
    'ciemny-cyber',
    'Ciemny Cyber',
    'Nowoczesny ciemny grafit z neonową zielenią i fioletowym akcentem.',
    {
      canvas: '#0F172A',
      surface: '#1E293B',
      primary: '#22C55E',
      accent: '#A855F7',
      isDark: true,
    }
  ),
  createColorTheme(
    'grafitowy-minimal',
    'Grafitowy Minimal',
    'Szwajcarski, czysty minimalizm w odcieniach grafitu z kobaltowym focusem.',
    {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      primary: '#334155',
      accent: '#2563EB',
      isDark: false,
    }
  ),
];

export function resolveThemeById(
  themeId: string | undefined,
  customThemes: ColorTheme[] = []
): ColorTheme {
  const all = [...PRESET_THEMES, ...customThemes];
  return (
    all.find((t) => t.id === themeId) ??
    PRESET_THEMES[0]
  );
}
