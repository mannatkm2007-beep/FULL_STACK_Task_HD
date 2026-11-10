/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Light / dark theme.
// The chosen theme is saved in localStorage, and the first visit follows the
// device setting (prefers-color-scheme). The theme itself is plain CSS:
// we only set data-theme="dark" | "light" on <html> and index.css swaps
// the colour variables.

const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage can be blocked (private mode) - fall through to the device setting
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply the theme to the page and remember it
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore - the theme still works for this visit
    }
  }, [theme]);

  // useCallback keeps the same function between renders, so components that
  // receive it do not re-render for no reason
  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  // useMemo stops every consumer re-rendering unless theme really changed
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
