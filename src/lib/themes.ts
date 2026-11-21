// Store themes. Colours and decorations live in globals.css under [data-anime="<id>"].
// All artwork is original (drawn in CSS/canvas); no franchise characters, logos or screenshots are used.

export type Wallpaper = "leaves" | "flames" | "petals" | "rain" | null;

export type StoreTheme = {
  id: string;
  name: string;
  tagline: string;
  /** Colours for the preview swatch: background, accent, secondary. */
  swatch: [string, string, string];
  wallpaper: Wallpaper;
};

export const THEMES = [
  { id: "classic", name: "Classic dark", tagline: "The original premium look", swatch: ["#09090c", "#f0506e", "#23232c"], wallpaper: null },
  { id: "light", name: "Classic light", tagline: "Clean and bright", swatch: ["#f7f6f3", "#e23c5c", "#e6e4df"], wallpaper: null },
  { id: "shinobi", name: "Shinobi Sunset", tagline: "Ninja orange with falling leaves", swatch: ["#0f0c0a", "#ff7a1a", "#3f8f4e"], wallpaper: "leaves" },
  { id: "cursed", name: "Cursed Energy", tagline: "Violet flames and sorcery", swatch: ["#07060f", "#8b5cf6", "#2563eb"], wallpaper: "flames" },
  { id: "sakura", name: "Sakura Night", tagline: "Cherry blossoms under the moon", swatch: ["#140b12", "#ff7eb6", "#c084fc"], wallpaper: "petals" },
  { id: "neon", name: "Neo Tokyo", tagline: "Cyberpunk neon rain", swatch: ["#05060a", "#00e5ff", "#ff2bd6"], wallpaper: "rain" },
  { id: "manga", name: "Manga Ink", tagline: "Black ink, paper and comic panels", swatch: ["#f4f1ea", "#e11d2e", "#0b0b0b"], wallpaper: null },
] as const satisfies readonly StoreTheme[];

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];
export const THEME_KEY = "ob-anime";
export const MOTION_KEY = "ob-motion";

export function themeById(id: string | null | undefined): StoreTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/**
 * Applies a theme to <html>. "classic"/"light" use the original palette; the others set data-anime.
 * Kept dependency-free so the same logic can run in the pre-paint inline script.
 */
export function applyTheme(id: string) {
  const d = document.documentElement;
  if (id === "light") d.dataset.theme = "light";
  else delete d.dataset.theme;
  if (id === "classic" || id === "light") delete d.dataset.anime;
  else d.dataset.anime = id;
}

/**
 * Inline script that runs before the storefront paints, so there's no flash of the wrong theme.
 * Order: ?theme= preview link, then the shopper's saved choice (if allowed), then the store default.
 */
export function themeBootScript(defaultTheme: ThemeId, allowChoice: boolean) {
  const ids = JSON.stringify(THEME_IDS);
  return `(function(){try{var d=document.documentElement,ids=${ids},def=${JSON.stringify(defaultTheme)},t=def;
var q=new URLSearchParams(location.search).get("theme");
if(q&&ids.indexOf(q)>-1){t=q}else if(${allowChoice ? "true" : "false"}){var s=localStorage.getItem("${THEME_KEY}");if(!s&&localStorage.getItem("ob-theme")==="light")s="light";if(s&&ids.indexOf(s)>-1)t=s}
if(t==="light")d.dataset.theme="light";else delete d.dataset.theme;
if(t==="classic"||t==="light")delete d.dataset.anime;else d.dataset.anime=t;
}catch(e){}})()`;
}
