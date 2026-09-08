import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'classic' | 'ocean' | 'crimson' | 'neon';

export interface ThemeDef {
  label: string;
  swatchClass: string;
  bgGradientClass: string;
  blobClasses: [string, string];
  accentTextClass: string;
  glowClass: string;
  headerIconWrapClass: string;
  headerIconClass: string;
  buttonClass: string;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  classic: {
    label: 'Classic',
    swatchClass: 'bg-amber-400',
    bgGradientClass: 'bg-gradient-hero',
    blobClasses: ['bg-blue-600/10', 'bg-amber-500/8'],
    accentTextClass: 'text-amber-400',
    glowClass: 'text-glow-gold',
    headerIconWrapClass: 'bg-amber-500/10 border border-amber-500/30',
    headerIconClass: 'text-amber-400',
    buttonClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20',
  },
  ocean: {
    label: 'Ocean',
    swatchClass: 'bg-cyan-400',
    bgGradientClass: 'bg-gradient-hero-ocean',
    blobClasses: ['bg-cyan-500/10', 'bg-blue-600/10'],
    accentTextClass: 'text-cyan-400',
    glowClass: 'text-glow-blue',
    headerIconWrapClass: 'bg-cyan-500/10 border border-cyan-500/30',
    headerIconClass: 'text-cyan-400',
    buttonClass: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20',
  },
  crimson: {
    label: 'Crimson',
    swatchClass: 'bg-red-400',
    bgGradientClass: 'bg-gradient-hero-crimson',
    blobClasses: ['bg-red-600/10', 'bg-amber-600/8'],
    accentTextClass: 'text-red-400',
    glowClass: 'text-glow-red',
    headerIconWrapClass: 'bg-red-500/10 border border-red-500/30',
    headerIconClass: 'text-red-400',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20',
  },
  neon: {
    label: 'Neon',
    swatchClass: 'bg-fuchsia-400',
    bgGradientClass: 'bg-gradient-hero-neon',
    blobClasses: ['bg-fuchsia-500/15', 'bg-cyan-400/10'],
    accentTextClass: 'text-fuchsia-400',
    glowClass: 'text-glow-neon',
    headerIconWrapClass: 'bg-fuchsia-500/10 border border-fuchsia-500/30',
    headerIconClass: 'text-fuchsia-400',
    buttonClass: 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/30',
  },
};

export const THEME_STORAGE_KEY = 'anivara_theme';
const THEME_EVENT = 'anivara-theme-change';

function readStoredTheme(): ThemeId {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved && saved in THEMES) {
    return saved as ThemeId;
  }
  return 'classic';
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    const handleChange = () => {
      setThemeIdState(readStoredTheme());
    };

    window.addEventListener(THEME_EVENT, handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
      window.removeEventListener(THEME_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    localStorage.setItem(THEME_STORAGE_KEY, id);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { themeId, setThemeId, theme: THEMES[themeId] };
}
