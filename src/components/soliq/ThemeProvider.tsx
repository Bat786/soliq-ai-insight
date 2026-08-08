import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";

export const timeZones = [
  { id: "auto", label: "Auto (device)" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Berlin", label: "Frankfurt" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
] as const;

type Ctx = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  timeZone: string;
  setTimeZone: (tz: string) => void;
  resolvedZone: string;
  formatTime: (value: number | Date) => string;
  formatDate: (value: number | Date) => string;
};

const ThemeContext = createContext<Ctx | null>(null);

const THEME_KEY = "soliq.theme";
const TZ_KEY = "soliq.timezone";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [timeZone, setTimeZoneState] = useState<string>("auto");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const storedTz = localStorage.getItem(TZ_KEY);
    if (storedTheme === "light" || storedTheme === "dark") setThemeState(storedTheme);
    if (storedTz) setTimeZoneState(storedTz);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  }, []);

  const setTimeZone = useCallback((tz: string) => {
    setTimeZoneState(tz);
    localStorage.setItem(TZ_KEY, tz);
  }, []);

  const value = useMemo<Ctx>(() => {
    const resolvedZone =
      timeZone === "auto" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : timeZone;
    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
      timeZone,
      setTimeZone,
      resolvedZone,
      formatTime: (v) =>
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: resolvedZone,
        }).format(new Date(v)),
      formatDate: (v) =>
        new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: resolvedZone,
        }).format(new Date(v)),
    };
  }, [theme, timeZone, setTheme, setTimeZone]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
