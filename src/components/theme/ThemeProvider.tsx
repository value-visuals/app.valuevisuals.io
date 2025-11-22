// src/components/theme/ThemeProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeCtx = createContext<Ctx>({
  theme: "system",
  setTheme: () => {},
  toggle: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const effective = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  if (effective === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(saved);
    applyTheme(saved);

    const listener = () => {
      if ((localStorage.getItem("theme") as Theme) === "system") {
        applyTheme("system");
      }
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);

  const handleSet = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  };

  const toggle = () => handleSet(document.documentElement.classList.contains("dark") ? "light" : "dark");

  return (
    <ThemeCtx.Provider value={{ theme, setTheme: handleSet, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
