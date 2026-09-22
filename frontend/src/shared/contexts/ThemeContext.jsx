import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ACCENT_PRESETS,
  CUSTOM_ACCENT_ID,
  DEFAULT_ACCENT_ID,
  DEFAULT_CUSTOM_ACCENT,
  applyAccentTokens,
  buildAccentTokenCache,
  normalizeHex,
  resolveAccentSeed,
} from '@/shared/theme/palettes';

const ACCENT_ID_KEY = 'accentId';
const ACCENT_CUSTOM_KEY = 'accentCustomColor';
// Mirrors the derived tokens for both themes so the boot script in index.html
// can paint the user's accent before React has loaded (see initAccent there).
const ACCENT_CACHE_KEY = 'accentTokenCache';

// Create the context
const ThemeContext = createContext();

// Export the context
export { ThemeContext };

const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); the accent still
    // applies for this session, it just will not survive a reload.
  }
};

export function ThemeProvider({ children }) {
  const [useSystemTheme, setUseSystemTheme] = useState(() => {
    const savedPreference = localStorage.getItem('useSystemTheme');
    return savedPreference === null ? true : savedPreference === 'true';
  });
  
  const [theme, setTheme] = useState(() => {
    // Get saved theme from localStorage or use preferred color scheme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && !JSON.parse(localStorage.getItem('useSystemTheme') || 'true')) {
      return savedTheme;
    }
    // Check if user prefers dark mode
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [accentId, setAccentIdState] = useState(() => {
    const saved = readStorage(ACCENT_ID_KEY, DEFAULT_ACCENT_ID);
    if (saved === CUSTOM_ACCENT_ID) return CUSTOM_ACCENT_ID;
    return ACCENT_PRESETS.some((preset) => preset.id === saved) ? saved : DEFAULT_ACCENT_ID;
  });

  const [customAccent, setCustomAccentState] = useState(
    () => normalizeHex(readStorage(ACCENT_CUSTOM_KEY, DEFAULT_CUSTOM_ACCENT)) || DEFAULT_CUSTOM_ACCENT,
  );

  // Listen for system theme changes when useSystemTheme is true
  useEffect(() => {
    if (useSystemTheme) {
      const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        setTheme(mediaQuery.matches ? 'dark' : 'light');
      };
      
      // Set initial theme based on system preference
      handleChange();
      
      // Add listener for system theme changes
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        // For older browsers
        mediaQuery.addListener(handleChange);
      }
      
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else {
          // For older browsers
          mediaQuery.removeListener(handleChange);
        }
      };
    }
  }, [useSystemTheme]);

  // Apply theme as data attribute on root html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save useSystemTheme preference
  useEffect(() => {
    localStorage.setItem('useSystemTheme', useSystemTheme.toString());
  }, [useSystemTheme]);

  const accentSeed = useMemo(
    () => resolveAccentSeed(accentId, customAccent),
    [accentId, customAccent],
  );

  // Derive the accent ramp and push it onto :root. Re-runs on theme change
  // because light and dark need different lightness for the same seed.
  useEffect(() => {
    const cache = buildAccentTokenCache(accentSeed);
    applyAccentTokens(cache[theme]);
    writeStorage(ACCENT_CACHE_KEY, JSON.stringify(cache));
  }, [accentSeed, theme]);

  useEffect(() => {
    writeStorage(ACCENT_ID_KEY, accentId);
  }, [accentId]);

  useEffect(() => {
    writeStorage(ACCENT_CUSTOM_KEY, customAccent);
  }, [customAccent]);

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  }, []);

  const setAccent = useCallback((nextId) => {
    if (nextId === CUSTOM_ACCENT_ID || ACCENT_PRESETS.some((preset) => preset.id === nextId)) {
      setAccentIdState(nextId);
    }
  }, []);

  /** Picking a custom colour implies switching to the custom accent. */
  const setCustomAccent = useCallback((hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    setCustomAccentState(normalized);
    setAccentIdState(CUSTOM_ACCENT_ID);
  }, []);

  const resetAccent = useCallback(() => {
    setAccentIdState(DEFAULT_ACCENT_ID);
    setCustomAccentState(DEFAULT_CUSTOM_ACCENT);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      useSystemTheme,
      setUseSystemTheme,
      accentId,
      setAccent,
      customAccent,
      setCustomAccent,
      resetAccent,
      accentSeed,
      accentPresets: ACCENT_PRESETS,
    }),
    [theme, toggleTheme, useSystemTheme, accentId, setAccent, customAccent, setCustomAccent, resetAccent, accentSeed],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
