import { useEffect, useState } from "react";
export function useTheme() {
  const [theme, setTheme] = useState<"classic" | "club">(() => {
    try {
      return localStorage.getItem("office-poker:theme") === "club"
        ? "club"
        : "classic";
    } catch {
      return "classic";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("office-poker:theme", theme);
    } catch {}
  }, [theme]);
  return {
    theme,
    toggle: () =>
      setTheme((current) => (current === "classic" ? "club" : "classic")),
  };
}
