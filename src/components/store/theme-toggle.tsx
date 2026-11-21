// Applies the saved light/dark choice before first paint on every page (admin included).
// Storefront anime themes are applied afterwards by the store layout's boot script (see lib/themes.ts).
export const THEME_SCRIPT = `try{var t=localStorage.getItem("ob-theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
