"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export const THEME_SCRIPT = `try{var t=localStorage.getItem("ob-theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("ob-theme", next);
    } catch {}
  }
  return (
    <button onClick={toggle} className={cn("grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2", className)} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
    </button>
  );
}
