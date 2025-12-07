import { createContext, useState, useEffect } from 'react';

// Create the context
const ThemeContext = createContext();

// Export the context
export { ThemeContext };

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

  // Toggle theme function
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      useSystemTheme, 
      setUseSystemTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
