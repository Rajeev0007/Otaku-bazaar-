"use client";

import { useEffect, useRef } from "react";
import type { Wallpaper } from "@/lib/themes";

type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; life: number; hue: number; a: number };

/**
 * Original animated "live wallpaper" drawn on one canvas behind the page.
 * Leaves, cursed flames, sakura petals or neon rain depending on the theme.
 * Lightweight: capped device-pixel ratio, fewer particles on small screens, pauses when the tab
 * is hidden, and renders a single still frame for visitors who prefer reduced motion.
 */
export function AnimeWallpaper({ kind, enabled = true }: { kind: Wallpaper; enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !kind || !enabled) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    const ps: P[] = [];

    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue("--accent").trim() || "#ff7a1a";
    const accent2 = css.getPropertyValue("--accent-2").trim() || accent;

    const count = () => {
      const area = (w * h) / (1280 * 800);
      const base = { leaves: 26, flames: 46, petals: 34, rain: 90 }[kind];
      return Math.round(Math.max(10, Math.min(base * 1.4, base * area)) * (w < 640 ? 0.55 : 1));
    };

    const spawn = (initial: boolean): P => {
      const rnd = Math.random;
      switch (kind) {
        case "leaves":
          return { x: rnd() * w, y: initial ? rnd() * h : -20, vx: 18 + rnd() * 30, vy: 22 + rnd() * 30, r: 7 + rnd() * 8, rot: rnd() * 6.28, vr: (rnd() - 0.5) * 2.2, life: rnd() * 100, hue: rnd() < 0.3 ? 1 : 0, a: 0.35 + rnd() * 0.35 };
        case "petals":
          return { x: rnd() * w, y: initial ? rnd() * h : -16, vx: 10 + rnd() * 24, vy: 16 + rnd() * 22, r: 4 + rnd() * 5, rot: rnd() * 6.28, vr: (rnd() - 0.5) * 3, life: rnd() * 100, hue: rnd(), a: 0.45 + rnd() * 0.4 };
        case "flames":
          return { x: rnd() * w, y: initial ? rnd() * h : h + 20, vx: (rnd() - 0.5) * 10, vy: -(14 + rnd() * 34), r: 10 + rnd() * 26, rot: 0, vr: 0, life: initial ? rnd() : 0, hue: rnd(), a: 0.05 + rnd() * 0.09 };
        case "rain":
        default:
          return { x: rnd() * w, y: initial ? rnd() * h : -40, vx: -40, vy: 520 + rnd() * 420, r: 10 + rnd() * 24, rot: 0, vr: 0, life: 0, hue: rnd() < 0.25 ? 1 : 0, a: 0.12 + rnd() * 0.25 };
      }
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = count();
      while (ps.length < n) ps.push(spawn(true));
      ps.length = n;
    };

    const leaf = (p: P) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.hue ? accent : "#3f8f4e";
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r * 0.9, -p.r * 0.2, 0, p.r);
      ctx.quadraticCurveTo(-p.r * 0.9, -p.r * 0.2, 0, -p.r);
      ctx.fill();
      ctx.globalAlpha = p.a * 0.6;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -p.r * 0.85);
      ctx.lineTo(0, p.r * 1.25);
      ctx.stroke();
      ctx.restore();
    };

    const petal = (p: P) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.life * 0.04))); // fluttering
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.hue < 0.7 ? "#ffb7d5" : "#ffd9ea";
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.bezierCurveTo(p.r, -p.r, p.r, p.r * 0.6, 0, p.r);
      ctx.bezierCurveTo(-p.r, p.r * 0.6, -p.r, -p.r, -p.r * 0.15, -p.r * 0.7);
      ctx.lineTo(0, -p.r);
      ctx.fill();
      ctx.restore();
    };

    const flame = (p: P) => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      const c = p.hue < 0.6 ? accent : accent2;
      g.addColorStop(0, c);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = p.a * Math.sin(Math.min(1, p.life) * Math.PI);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drop = (p: P) => {
      ctx.globalAlpha = p.a;
      ctx.strokeStyle = p.hue ? accent2 : accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.03, p.y - p.r);
      ctx.stroke();
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      if (kind === "flames") ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]!;
        p.life += kind === "flames" ? dt * 0.12 : dt * 60;
        p.x += (p.vx + (kind === "leaves" || kind === "petals" ? Math.sin(p.life * 0.02) * 22 : 0)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const gone = kind === "flames" ? p.life >= 1 || p.y < -40 : p.y > h + 30 || p.x > w + 40 || p.x < -60;
        if (gone) ps[i] = spawn(false);
        if (kind === "leaves") leaf(p);
        else if (kind === "petals") petal(p);
        else if (kind === "flames") flame(p);
        else drop(p);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }, [kind, enabled]);

  if (!kind || !enabled) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
