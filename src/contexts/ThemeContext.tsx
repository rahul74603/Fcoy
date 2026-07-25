import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppTheme = 'classic' | 'command';

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'fcoy_app_theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'command';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'classic' || saved === 'command' ? saved : 'command';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'command' ? 'classic' : 'command'));
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.classList.toggle('theme-command', theme === 'command');
    document.body.classList.toggle('theme-classic', theme === 'classic');
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
