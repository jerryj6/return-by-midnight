// Procedurally drawn museum pieces that have no approved sprite.
// Same language as the art kit: warm brass, cream highlights, teal and rust, dark ink outlines.
import type { Graphics } from "pixi.js";
import { C } from "./palette";

const OUT = 0x1a1410;

/** Wind-up tin mouse. (cx, feet) = bottom centre; s = tile size. */
export function drawToy(g: Graphics, cx: number, feet: number, s: number) {
  const w = s * 0.62, h = s * 0.34, by = feet - s * 0.08;
  g.ellipse(cx, feet - s * 0.03, w * 0.55, s * 0.07).fill({ color: 0x000000, alpha: 0.35 });
  // wheels
  g.circle(cx - w * 0.28, by, s * 0.07).fill(0x3a3029).stroke({ width: 1.5, color: OUT });
  g.circle(cx + w * 0.22, by, s * 0.07).fill(0x3a3029).stroke({ width: 1.5, color: OUT });
  // body
  g.ellipse(cx, by - h * 0.55, w * 0.5, h * 0.55).fill(0xbfc4c6).stroke({ width: 2, color: OUT });
  g.ellipse(cx - w * 0.08, by - h * 0.78, w * 0.3, h * 0.22).fill({ color: 0xffffff, alpha: 0.35 });
  // stripes of painted tin
  g.moveTo(cx - w * 0.12, by - h * 1.05).quadraticCurveTo(cx - w * 0.18, by - h * 0.5, cx - w * 0.1, by - h * 0.05).stroke({ width: 2.5, color: C.rust });
  g.moveTo(cx + w * 0.1, by - h * 1.08).quadraticCurveTo(cx + w * 0.06, by - h * 0.5, cx + w * 0.12, by - h * 0.02).stroke({ width: 2.5, color: C.rust });
  // head + ear + nose
  g.circle(cx + w * 0.5, by - h * 0.5, h * 0.42).fill(0xbfc4c6).stroke({ width: 2, color: OUT });
  g.circle(cx + w * 0.42, by - h * 0.98, h * 0.28).fill(0xd99a8a).stroke({ width: 2, color: OUT });
  g.circle(cx + w * 0.86, by - h * 0.45, s * 0.03).fill(OUT);
  g.circle(cx + w * 0.56, by - h * 0.6, s * 0.022).fill(OUT);
  // tail
  g.moveTo(cx - w * 0.5, by - h * 0.4).quadraticCurveTo(cx - w * 0.85, by - h * 0.2, cx - w * 0.78, by - h * 0.85).stroke({ width: 2, color: OUT });
  // brass key
  const kx = cx - w * 0.05, ky = by - h * 1.1;
  g.rect(kx - 1.5, ky - s * 0.12, 3, s * 0.12).fill(C.gold);
  g.ellipse(kx - s * 0.08, ky - s * 0.15, s * 0.07, s * 0.05).fill(C.gold).stroke({ width: 1.5, color: OUT });
  g.ellipse(kx + s * 0.08, ky - s * 0.15, s * 0.07, s * 0.05).fill(C.gold).stroke({ width: 1.5, color: OUT });
  return s * 0.62;
}

/** Inlaid wooden music box with brass crank. Returns drawn height. */
export function drawMusicBox(g: Graphics, cx: number, feet: number, s: number, open: boolean) {
  const w = s * 0.72, h = s * 0.36, top = feet - h - s * 0.06;
  g.ellipse(cx, feet - s * 0.03, w * 0.6, s * 0.08).fill({ color: 0x000000, alpha: 0.35 });
  // lid (open = tilted back)
  if (open) {
    g.poly([cx - w / 2, top, cx + w / 2, top, cx + w * 0.42, top - h * 0.9, cx - w * 0.42, top - h * 0.9]).fill(0x5b2f1f).stroke({ width: 2, color: OUT });
    g.poly([cx - w * 0.36, top - h * 0.12, cx + w * 0.36, top - h * 0.12, cx + w * 0.3, top - h * 0.75, cx - w * 0.3, top - h * 0.75]).fill(C.teal);
  }
  // front face
  g.roundRect(cx - w / 2, top, w, h, 3).fill(0x7a4128).stroke({ width: 2, color: OUT });
  g.rect(cx - w / 2 + 3, top + h * 0.18, w - 6, 2).fill(C.gold);
  g.rect(cx - w / 2 + 3, top + h * 0.8, w - 6, 2).fill(C.gold);
  // inlay medallion
  g.circle(cx, top + h * 0.5, h * 0.2).fill(0xe8d3a0).stroke({ width: 1.5, color: C.gold });
  if (!open) g.rect(cx - w / 2 - 1, top - h * 0.18, w + 2, h * 0.2).fill(0x5b2f1f).stroke({ width: 2, color: OUT });
  // crank
  const kx = cx + w / 2, ky = top + h * 0.5;
  g.rect(kx, ky - 1.5, s * 0.1, 3).fill(C.gold);
  g.rect(kx + s * 0.08, ky - s * 0.1, 3, s * 0.1).fill(C.gold);
  g.circle(kx + s * 0.095, ky - s * 0.11, s * 0.03).fill(C.cream).stroke({ width: 1, color: OUT });
  return h + s * 0.06 + (open ? h * 0.9 : h * 0.18);
}

/** The Clockwork Nightingale on a velvet cushion. */
export function drawNightingale(g: Graphics, cx: number, feet: number, s: number, t: number) {
  const bob = Math.sin(t * 2.2) * s * 0.015;
  g.ellipse(cx, feet - s * 0.05, s * 0.34, s * 0.09).fill({ color: 0x000000, alpha: 0.35 });
  g.ellipse(cx, feet - s * 0.12, s * 0.32, s * 0.11).fill(0x7c2433).stroke({ width: 2, color: OUT });
  g.ellipse(cx - s * 0.08, feet - s * 0.16, s * 0.12, s * 0.03).fill({ color: 0xffffff, alpha: 0.18 });
  const by = feet - s * 0.3 + bob;
  // tail
  g.poly([cx - s * 0.14, by, cx - s * 0.36, by - s * 0.1, cx - s * 0.3, by + s * 0.04]).fill(C.gold).stroke({ width: 1.5, color: OUT });
  // body
  g.ellipse(cx, by, s * 0.17, s * 0.12).fill(0xe0b450).stroke({ width: 2, color: OUT });
  // wing (teal enamel)
  g.ellipse(cx - s * 0.03, by - s * 0.01, s * 0.1, s * 0.06).fill(C.teal).stroke({ width: 1.5, color: OUT });
  // head + beak + eye
  g.circle(cx + s * 0.15, by - s * 0.09, s * 0.08).fill(0xe0b450).stroke({ width: 2, color: OUT });
  g.poly([cx + s * 0.22, by - s * 0.1, cx + s * 0.32, by - s * 0.07, cx + s * 0.22, by - s * 0.05]).fill(C.rust).stroke({ width: 1, color: OUT });
  g.circle(cx + s * 0.17, by - s * 0.11, s * 0.017).fill(OUT);
  // little key
  g.circle(cx - s * 0.02, by - s * 0.15, s * 0.03).fill(C.cream).stroke({ width: 1, color: OUT });
  // sparkle
  const sp = (Math.sin(t * 3) + 1) / 2;
  g.star(cx + s * 0.05, by - s * 0.3, 4, s * 0.06 * (0.6 + sp * 0.4), s * 0.015).fill({ color: 0xfff3c4, alpha: 0.5 + sp * 0.5 });
  return s * 0.5;
}

/** Small bird badge carried over a crew member's head. */
export function drawBirdBadge(g: Graphics, cx: number, cy: number, s: number) {
  g.circle(cx, cy, s * 0.17).fill(C.ink2).stroke({ width: 2, color: C.gold });
  g.ellipse(cx - s * 0.01, cy + s * 0.01, s * 0.08, s * 0.055).fill(0xe0b450);
  g.circle(cx + s * 0.07, cy - s * 0.04, s * 0.04).fill(0xe0b450);
  g.poly([cx + s * 0.1, cy - s * 0.05, cx + s * 0.15, cy - s * 0.03, cx + s * 0.1, cy - s * 0.02]).fill(C.rust);
}

/** Padlock badge for "locked in". */
export function drawLock(g: Graphics, cx: number, cy: number, r: number, color: number) {
  g.circle(cx, cy, r).fill(C.ink2).stroke({ width: 2, color });
  g.roundRect(cx - r * 0.45, cy - r * 0.05, r * 0.9, r * 0.6, 2).fill(color);
  g.moveTo(cx - r * 0.28, cy - r * 0.05).lineTo(cx - r * 0.28, cy - r * 0.3).arc(cx, cy - r * 0.3, r * 0.28, Math.PI, 0).lineTo(cx + r * 0.28, cy - r * 0.05).stroke({ width: 2, color });
}

/** Vertical gate (door in an east–west running wall gap). */
export function drawSideGate(g: Graphics, px: number, py: number, s: number, open: boolean) {
  const x0 = px + s * 0.38, w = s * 0.24;
  g.rect(x0, py - s * 0.35, w, s * 0.18).fill(0xcdbb95).stroke({ width: 1.5, color: OUT });
  g.rect(x0, py + s * 0.82, w, s * 0.18).fill(0xcdbb95).stroke({ width: 1.5, color: OUT });
  if (open) {
    g.rect(x0 + w * 0.2, py - s * 0.17, w * 0.6, s * 0.16).fill(0x6b5530);
    return;
  }
  g.rect(x0 + w * 0.15, py - s * 0.17, w * 0.7, s * 0.99).fill(0x3a3227).stroke({ width: 1.5, color: OUT });
  for (let i = 1; i <= 4; i++) g.rect(x0 + w * 0.15, py - s * 0.17 + i * s * 0.19, w * 0.7, 2).fill(C.gold);
}
