// Generates tasteful placeholder product renders for demo/seed data. Real stores replace these with photos
// uploaded in the admin. Output is deterministic for a given input, so it caches forever.

export const ART_KINDS = [
  "tshirt", "hoodie", "cap", "poster", "phone", "keychain", "figure", "sticker", "mug", "bag",
  "jewelry", "gaming", "cosplay", "gift", "mystery", "manga", "giftcard", "banner",
] as const;
export type ArtKind = (typeof ART_KINDS)[number];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SHAPES: Record<Exclude<ArtKind, "banner">, (fill: string, accent: string, mark: string) => string> = {
  tshirt: (f, a, m) => `
    <path d="M262 300 L340 252 Q400 292 460 252 L538 300 L628 402 L560 452 L540 424 L540 770 Q400 786 260 770 L260 424 L240 452 L172 402 Z" fill="${f}"/>
    <path d="M340 252 Q400 300 460 252" stroke="${a}" stroke-width="6" fill="none" opacity=".5"/>
    <g transform="translate(400 520)"><circle r="92" fill="none" stroke="${a}" stroke-width="10"/><text y="26" text-anchor="middle" font-size="78" font-weight="800" fill="${a}">${m}</text></g>`,
  hoodie: (f, a, m) => `
    <path d="M300 300 Q400 170 500 300 L560 320 L640 470 L640 760 L580 770 L570 520 L560 520 L560 790 Q400 806 240 790 L240 520 L230 520 L220 770 L160 760 L160 470 L240 320 Z" fill="${f}"/>
    <path d="M318 300 Q400 216 482 300 Q400 362 318 300 Z" fill="#000" opacity=".28"/>
    <path d="M300 640 L500 640 L520 730 L280 730 Z" fill="#000" opacity=".16"/>
    <line x1="380" y1="330" x2="372" y2="420" stroke="${a}" stroke-width="5"/><line x1="420" y1="330" x2="428" y2="420" stroke="${a}" stroke-width="5"/>
    <text x="400" y="560" text-anchor="middle" font-size="64" font-weight="800" letter-spacing="8" fill="${a}">${m}</text>`,
  cap: (f, a, m) => `
    <path d="M220 560 Q220 340 400 330 Q580 340 580 560 Z" fill="${f}"/>
    <path d="M200 560 Q400 520 640 590 Q620 640 560 630 Q400 590 210 600 Z" fill="${f}" opacity=".8"/>
    <circle cx="400" cy="338" r="14" fill="${a}"/>
    <text x="400" y="490" text-anchor="middle" font-size="70" font-weight="800" fill="${a}">${m}</text>`,
  poster: (f, a, m) => `
    <rect x="200" y="190" width="400" height="560" rx="6" fill="#0b0b10" stroke="${f}" stroke-width="18"/>
    <circle cx="400" cy="400" r="110" fill="${a}" opacity=".9"/>
    <path d="M218 700 L330 520 L400 610 L480 470 L582 700 Z" fill="${f}" opacity=".9"/>
    <text x="400" y="260" text-anchor="middle" font-size="28" letter-spacing="10" fill="${f}">${m}</text>`,
  phone: (f, a, m) => `
    <rect x="270" y="200" width="260" height="560" rx="44" fill="${f}"/>
    <rect x="300" y="232" width="110" height="120" rx="26" fill="#000" opacity=".35"/>
    <circle cx="333" cy="268" r="20" fill="#111"/><circle cx="377" cy="268" r="20" fill="#111"/><circle cx="333" cy="316" r="20" fill="#111"/>
    <circle cx="400" cy="520" r="74" fill="none" stroke="${a}" stroke-width="10"/>
    <text x="400" y="545" text-anchor="middle" font-size="64" font-weight="800" fill="${a}">${m}</text>`,
  keychain: (f, a, m) => `
    <circle cx="400" cy="250" r="54" fill="none" stroke="#c9c9d1" stroke-width="12"/>
    <rect x="392" y="300" width="16" height="90" rx="8" fill="#c9c9d1"/>
    <path d="M400 390 L470 430 L470 620 Q400 680 330 620 L330 430 Z" fill="${f}"/>
    <path d="M400 390 L470 430 L470 620 Q400 680 330 620 L330 430 Z" fill="none" stroke="#fff" stroke-width="6" opacity=".5"/>
    <text x="400" y="555" text-anchor="middle" font-size="62" font-weight="800" fill="${a}">${m}</text>`,
  figure: (f, a, m) => `
    <ellipse cx="400" cy="760" rx="170" ry="34" fill="#000" opacity=".4"/>
    <ellipse cx="400" cy="740" rx="150" ry="26" fill="${f}" opacity=".7"/>
    <path d="M330 730 L350 520 Q400 480 450 520 L470 730 Z" fill="${f}"/>
    <path d="M350 540 L270 640 L290 652 L362 580 Z M450 540 L540 470 L552 488 L440 590 Z" fill="${f}"/>
    <circle cx="400" cy="420" r="96" fill="${f}"/>
    <path d="M304 410 Q330 300 420 312 Q500 320 500 420 Q470 360 400 360 Q340 360 304 410 Z" fill="${a}"/>
    <text x="400" y="680" text-anchor="middle" font-size="40" font-weight="800" fill="${a}">${m}</text>`,
  sticker: (f, a, m) => `
    <g transform="rotate(-10 330 420)"><rect x="220" y="300" width="220" height="220" rx="40" fill="#fff"/><rect x="236" y="316" width="188" height="188" rx="30" fill="${f}"/><text x="330" y="440" text-anchor="middle" font-size="70" font-weight="800" fill="${a}">${m}</text></g>
    <g transform="rotate(12 500 560)"><circle cx="500" cy="560" r="110" fill="#fff"/><circle cx="500" cy="560" r="94" fill="${a}"/><path d="M450 560 L490 600 L560 520" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round"/></g>
    <g transform="rotate(-4 340 700)"><rect x="250" y="640" width="200" height="110" rx="55" fill="#fff"/><rect x="264" y="654" width="172" height="82" rx="41" fill="${f}"/></g>`,
  mug: (f, a, m) => `
    <path d="M260 330 L540 330 L520 740 Q400 770 280 740 Z" fill="${f}"/>
    <path d="M536 400 Q640 400 630 520 Q620 630 520 620" stroke="${f}" stroke-width="40" fill="none"/>
    <ellipse cx="400" cy="330" rx="140" ry="22" fill="#000" opacity=".3"/>
    <text x="400" y="560" text-anchor="middle" font-size="76" font-weight="800" fill="${a}">${m}</text>`,
  bag: (f, a, m) => `
    <path d="M340 260 Q400 190 460 260" stroke="${f}" stroke-width="22" fill="none"/>
    <rect x="240" y="260" width="320" height="500" rx="70" fill="${f}"/>
    <rect x="280" y="520" width="240" height="190" rx="36" fill="#000" opacity=".2"/>
    <line x1="290" y1="540" x2="510" y2="540" stroke="${a}" stroke-width="6"/>
    <text x="400" y="440" text-anchor="middle" font-size="76" font-weight="800" fill="${a}">${m}</text>`,
  jewelry: (f, a, m) => `
    <path d="M250 230 Q400 620 550 230" stroke="#d6c38f" stroke-width="6" fill="none" stroke-dasharray="2 10" stroke-linecap="round"/>
    <circle cx="400" cy="520" r="18" fill="none" stroke="#d6c38f" stroke-width="6"/>
    <path d="M400 540 L470 620 L400 760 L330 620 Z" fill="${f}" stroke="#d6c38f" stroke-width="6"/>
    <text x="400" y="660" text-anchor="middle" font-size="44" font-weight="800" fill="${a}">${m}</text>`,
  gaming: (f, a, m) => `
    <path d="M250 420 Q400 380 550 420 Q640 440 660 620 Q670 720 600 720 Q560 720 520 640 L280 640 Q240 720 200 720 Q130 720 140 620 Q160 440 250 420 Z" fill="${f}"/>
    <rect x="250" y="500" width="70" height="22" rx="6" fill="${a}"/><rect x="274" y="476" width="22" height="70" rx="6" fill="${a}"/>
    <circle cx="520" cy="490" r="16" fill="${a}"/><circle cx="560" cy="530" r="16" fill="${a}"/><circle cx="480" cy="530" r="16" fill="${a}"/><circle cx="520" cy="570" r="16" fill="${a}"/>
    <text x="400" y="600" text-anchor="middle" font-size="36" font-weight="800" fill="${a}">${m}</text>`,
  cosplay: (f, a, m) => `
    <path d="M160 470 Q400 400 640 470 L640 540 Q400 470 160 540 Z" fill="${f}"/>
    <path d="M610 480 Q680 560 650 660 M630 500 Q720 600 700 700" stroke="${f}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="300" y="420" width="200" height="120" rx="14" fill="#c9c9d1"/>
    <text x="400" y="502" text-anchor="middle" font-size="56" font-weight="800" fill="#2a2a33">${m}</text>`,
  gift: (f, a) => `
    <rect x="230" y="400" width="340" height="340" rx="18" fill="${f}"/>
    <rect x="210" y="350" width="380" height="80" rx="14" fill="${f}"/><rect x="210" y="350" width="380" height="80" rx="14" fill="#fff" opacity=".08"/>
    <rect x="380" y="350" width="40" height="390" fill="${a}"/>
    <path d="M400 350 Q320 250 290 320 Q300 360 400 350 Q480 250 510 320 Q500 360 400 350 Z" fill="${a}"/>`,
  mystery: (f, a) => `
    <rect x="230" y="380" width="340" height="360" rx="18" fill="${f}"/>
    <rect x="210" y="330" width="380" height="80" rx="14" fill="${f}"/>
    <rect x="210" y="330" width="380" height="80" rx="14" fill="#fff" opacity=".08"/>
    <text x="400" y="660" text-anchor="middle" font-size="230" font-weight="900" fill="${a}">?</text>`,
  manga: (f, a, m) => `
    <rect x="250" y="250" width="270" height="380" rx="8" fill="${f}" transform="rotate(-6 385 440)"/>
    <rect x="290" y="300" width="270" height="380" rx="8" fill="${f}" opacity=".85"/>
    <rect x="290" y="300" width="270" height="380" rx="8" fill="#fff" opacity=".06"/>
    <rect x="290" y="300" width="24" height="380" fill="#000" opacity=".25"/>
    <text x="440" y="470" text-anchor="middle" font-size="72" font-weight="800" fill="${a}">${m}</text>
    <rect x="340" y="600" width="200" height="12" rx="6" fill="${a}" opacity=".6"/>`,
  giftcard: (f, a, m) => `
    <rect x="170" y="330" width="460" height="290" rx="28" fill="${f}"/>
    <rect x="170" y="330" width="460" height="290" rx="28" fill="none" stroke="${a}" stroke-width="4" opacity=".6"/>
    <text x="210" y="400" font-size="26" letter-spacing="6" fill="#fff" opacity=".8">THE OTAKU BAZAAR</text>
    <text x="210" y="570" font-size="70" font-weight="800" fill="${a}">${m}</text>`,
};

export function renderDemoArt(opts: { kind: string; color?: string; label?: string; mark?: string; variant?: number }): string {
  const kind = (ART_KINDS as readonly string[]).includes(opts.kind) ? (opts.kind as ArtKind) : "gift";
  const accent = /^#[0-9a-fA-F]{6}$/.test(opts.color ?? "") ? opts.color! : "#f0506e";
  const label = esc((opts.label ?? "").slice(0, 40));
  const mark = esc((opts.mark ?? "OB").slice(0, 4).toUpperCase());
  const v = Math.max(1, Math.min(3, opts.variant ?? 1));
  const seed = hash(`${kind}${accent}${label}${v}`);
  const fill = v === 2 ? "#e9e7ef" : v === 3 ? accent : "#24242d";
  const ink = v === 3 ? "#111118" : accent;

  if (kind === "banner") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" font-family="system-ui,-apple-system,Segoe UI,sans-serif">
<defs><radialGradient id="g" cx="${70 + (seed % 20)}%" cy="40%" r="70%"><stop offset="0" stop-color="${accent}" stop-opacity=".55"/><stop offset="1" stop-color="#0b0b10" stop-opacity="0"/></radialGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121219"/><stop offset="1" stop-color="#07070a"/></linearGradient></defs>
<rect width="1600" height="700" fill="url(#b)"/><rect width="1600" height="700" fill="url(#g)"/>
<g opacity=".08" stroke="#fff">${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 110}" y1="0" x2="${i * 110 - 300}" y2="700"/>`).join("")}</g>
<text x="1540" y="640" text-anchor="end" font-size="420" font-weight="900" fill="#fff" opacity=".04">${mark}</text>
<circle cx="${1100 + (seed % 120)}" cy="330" r="190" fill="none" stroke="${accent}" stroke-width="3" opacity=".7"/>
<circle cx="${1100 + (seed % 120)}" cy="330" r="130" fill="${accent}" opacity=".18"/>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" font-family="system-ui,-apple-system,Segoe UI,sans-serif">
<defs>
<radialGradient id="glow" cx="${40 + (seed % 25)}%" cy="${35 + (seed % 15)}%" r="65%"><stop offset="0" stop-color="${accent}" stop-opacity="${v === 2 ? 0.25 : 0.38}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v === 2 ? "#1b1b22" : "#14141b"}"/><stop offset="1" stop-color="#0a0a0e"/></linearGradient>
</defs>
<rect width="800" height="1000" fill="url(#bg)"/>
<rect width="800" height="1000" fill="url(#glow)"/>
<text x="${v === 3 ? 60 : 740}" y="${v === 3 ? 330 : 960}" text-anchor="${v === 3 ? "start" : "end"}" font-size="300" font-weight="900" fill="#fff" opacity=".035">${mark}</text>
<g transform="${v === 2 ? "translate(-200 -200) scale(1.5)" : v === 3 ? "translate(40 30) scale(0.92)" : ""}">${SHAPES[kind](fill, ink, mark)}</g>
<text x="40" y="950" font-size="22" letter-spacing="6" fill="#fff" opacity=".5">${label.toUpperCase()}</text>
<text x="760" y="60" text-anchor="end" font-size="16" letter-spacing="4" fill="#fff" opacity=".35">DEMO IMAGE</text>
</svg>`;
}

/** URL for the demo art route. */
export function demoArtUrl(kind: ArtKind, color: string, label: string, mark: string, variant = 1) {
  const p = new URLSearchParams({ c: color, l: label, m: mark, v: String(variant) });
  return `/demo-art/${kind}.svg?${p.toString()}`;
}
