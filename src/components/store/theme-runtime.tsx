"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, MOTION_KEY, THEME_IDS, THEME_KEY, THEMES, themeById, type ThemeId } from "@/lib/themes";
import { AnimeWallpaper } from "@/components/store/anime-wallpaper";
import { cn } from "@/lib/utils";

const EVENT = "ob-theme-change";

function readSaved(defaultTheme: ThemeId, allowChoice: boolean): ThemeId {
  try {
    const q = new URLSearchParams(location.search).get("theme");
    if (q && (THEME_IDS as string[]).includes(q)) return q as ThemeId;
    if (allowChoice) {
      let s = localStorage.getItem(THEME_KEY);
      if (!s && localStorage.getItem("ob-theme") === "light") s = "light";
      if (s && (THEME_IDS as string[]).includes(s)) return s as ThemeId;
    }
  } catch {
    // storage blocked
  }
  return defaultTheme;
}

function motionOn() {
  try {
    return localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Keeps <html> in sync with the chosen theme on client navigation and draws the live wallpaper.
 * The first paint is handled by the inline boot script in the store layout.
 */
export function ThemeRuntime({ defaultTheme, allowChoice, wallpapers }: { defaultTheme: ThemeId; allowChoice: boolean; wallpapers: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(defaultTheme);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const t = readSaved(defaultTheme, allowChoice);
    setTheme(t);
    setMotion(motionOn());
    applyTheme(t);
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ theme?: ThemeId; motion?: boolean }>).detail;
      if (d.theme) setTheme(d.theme);
      if (d.motion !== undefined) setMotion(d.motion);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      // Leaving the storefront (e.g. to /admin): go back to the plain look.
      applyTheme(localStorage.getItem("ob-theme") === "light" ? "light" : "classic");
    };
  }, [defaultTheme, allowChoice]);

  return <AnimeWallpaper kind={themeById(theme).wallpaper} enabled={wallpapers && motion} />;
}

/** Header button that opens the theme list. Only rendered when the owner allows shoppers to choose. */
export function ThemePicker({ className, wallpapers }: { className?: string; wallpapers: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>("classic");
  const [motion, setMotion] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = document.documentElement;
    setCurrent(d.dataset.anime ?? (d.dataset.theme === "light" ? "light" : "classic"));
    setMotion(motionOn());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function choose(id: ThemeId) {
    applyTheme(id);
    try {
      localStorage.setItem(THEME_KEY, id);
      localStorage.setItem("ob-theme", id === "light" || id === "manga" ? "light" : "dark");
    } catch {}
    setCurrent(id);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { theme: id } }));
  }

  function toggleMotion() {
    const next = !motion;
    setMotion(next);
    try {
      localStorage.setItem(MOTION_KEY, next ? "on" : "off");
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { motion: next } }));
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label="Change theme" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
        <PaletteIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-surface p-2 shadow-2xl" role="menu" aria-label="Themes">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Theme</p>
          <ul>
            {THEMES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={current === t.id}
                  onClick={() => choose(t.id)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2", current === t.id && "bg-surface-2")}
                >
                  <Swatch colors={t.swatch} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block truncate text-xs text-muted">{t.tagline}</span>
                  </span>
                  {current === t.id && <span className="text-xs font-semibold text-accent">On</span>}
                </button>
              </li>
            ))}
          </ul>
          {wallpapers && (
            <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-sm">
              <span>Animated background</span>
              <input type="checkbox" checked={motion} onChange={toggleMotion} className="h-4 w-4 accent-[var(--accent)]" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function Swatch({ colors, size = 32 }: { colors: readonly [string, string, string]; size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full border border-line-strong" style={{ width: size, height: size, background: colors[0] }} aria-hidden>
      <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: `linear-gradient(135deg, ${colors[1]}, ${colors[2]})` }} />
    </span>
  );
}

function PaletteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="10" cy="7" r="1.2" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
