import { useState } from 'react';
import { Palette } from 'lucide-react';
import { THEMES, useTheme, type ThemeId } from '@/lib/theme';

export function ThemePicker() {
  const { themeId, setThemeId, theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {open && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl flex flex-col gap-1 min-w-[140px]">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <button
              key={id}
              onClick={() => {
                setThemeId(id);
                setOpen(false);
              }}
              type="button"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                id === themeId ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${THEMES[id].swatchClass}`} />
              {THEMES[id].label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 rounded-xl shadow-lg transition-colors backdrop-blur-sm"
        type="button"
      >
        <Palette className="w-4 h-4 text-slate-400" />
        <span className={`w-3 h-3 rounded-full ${theme.swatchClass}`} />
      </button>
    </div>
  );
}
