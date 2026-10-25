import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { elevation } from '../lib/generate';
import type { BoardPlan } from '../lib/optimizer';
import { accessoryPacks, balanceAfterPayment, calculateInvoice, type ItemPrice, type QuoteCalc } from '../lib/pricing';
import { activeLegs, LEG_LABELS, legLength } from '../lib/runs';
import type { Catalog, Invoice, Payment, Quote, Room, Run, Settings, Unit } from '../lib/types';
import { addDaysISO, fmtDate, money } from '../lib/util';
import { renderAssemblyImage, renderRoomImage, renderRunImage, renderUnitImage } from '../render/scene';
import { footprints, inwardNormal, placeXZ, roomExtents, vertices, wallDir } from '../lib/room';
import { cellRects } from '../lib/sections';

import { usePdfExport } from './exportState';
export { usePdfExport };

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margin

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const imgFormat = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'PNG' : dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG');

function lastY(doc: Doc, fallback: number) {
  return doc.lastAutoTable?.finalY ?? fallback;
}

function ensureSpace(doc: Doc, y: number, needed: number, s: Settings): number {
  if (y + needed > PAGE_H - 26) {
    doc.addPage();
    return drawMiniHeader(doc, s);
  }
  return y;
}

const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [120, 113, 108];
const HAIR: [number, number, number] = [226, 222, 218];

/** Thin running header on continuation pages. */
function drawMiniHeader(doc: Doc, s: Settings): number {
  const accent = hexToRgb(s.doc.accentColor);
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, 1.6, 'F');
  let x = M;
  if (s.company.logo) {
    try {
      const pr = doc.getImageProperties(s.company.logo);
      const h = 6;
      const w = Math.min(22, (pr.width / pr.height) * h);
      doc.addImage(s.company.logo, imgFormat(s.company.logo), M, 5.5, w, h);
      x = M + w + 3;
    } catch {
      /* ignore broken logo */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(s.company.name, x, 10);
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.2);
  doc.line(M, 14, PAGE_W - M, 14);
  doc.setTextColor(0);
  return 20;
}

/**
 * Letterhead: the logo is sized into the header next to (or above) the company
 * details rather than pasted on top, the document title sits opposite in
 * spaced capitals with its reference block, and a hairline closes it.
 */
function drawHeader(doc: Doc, s: Settings, title: string, meta: [string, string][]): number {
  const accent = hexToRgb(s.doc.accentColor);
  const c = s.company;
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, 2.2, 'F');
  const pos = s.doc.logoPosition;
  const top = 13;

  // logo: fitted into a 22 mm tall slot, never wider than 52 mm
  let logo: { w: number; h: number } | null = null;
  if (c.logo) {
    try {
      const pr = doc.getImageProperties(c.logo);
      const k = Math.min(52 / pr.width, 22 / pr.height);
      logo = { w: pr.width * k, h: pr.height * k };
    } catch {
      logo = null;
    }
  }
  const lines = [...c.address.split('\n'), [c.phone, c.email].filter(Boolean).join('   ·   '), c.website, c.taxNumber ? `Tax no. ${c.taxNumber}` : '', ...s.doc.headerFields.filter((f) => f.label || f.value).map((f) => `${f.label}${f.label && f.value ? ': ' : ''}${f.value}`)].filter(Boolean);

  let textX = M;
  let align: 'left' | 'center' = 'left';
  let y = top;
  if (logo && pos === 'center') {
    doc.addImage(c.logo!, imgFormat(c.logo!), PAGE_W / 2 - logo.w / 2, y - 3, logo.w, logo.h);
    y += logo.h + 4;
    textX = PAGE_W / 2;
    align = 'center';
  } else if (logo) {
    const lx = pos === 'right' ? PAGE_W - M - logo.w : M;
    doc.addImage(c.logo!, imgFormat(c.logo!), lx, y - 3, logo.w, logo.h);
    if (pos === 'left') {
      textX = M + logo.w + 6;
      // a fine rule between the logo and the company details
      doc.setDrawColor(...HAIR);
      doc.setLineWidth(0.25);
      doc.line(M + logo.w + 3, y - 2, M + logo.w + 3, y + Math.max(logo.h, 12) - 4);
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(c.name, textX, y + 3, { align });
  let ly = y + 7.5;
  if (c.tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...accent);
    spaced(doc, c.tagline.toUpperCase(), textX, ly, 0.35, align);
    ly += 4.6;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  for (const l of lines) {
    doc.text(l, textX, ly, { align });
    ly += 3.7;
  }
  if (s.doc.headerText) {
    doc.setFont('helvetica', 'italic');
    for (const l of doc.splitTextToSize(s.doc.headerText, pos === 'center' ? 160 : 95)) {
      doc.text(l, textX, ly, { align });
      ly += 3.7;
    }
  }

  // title and reference block
  const right = PAGE_W - M;
  let ty = pos === 'center' ? ly + 6 : pos === 'right' && logo ? top + logo.h + 4 : top + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(21);
  doc.setTextColor(...accent);
  spaced(doc, title.toUpperCase(), right, ty + 4, 1.2, 'right');
  ty += 10;
  doc.setFontSize(7);
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    spaced(doc, k.toUpperCase(), right - 36, ty, 0.3, 'right');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(v, right, ty, { align: 'right' });
    doc.setFontSize(7);
    ty += 4.6;
  }
  const bottom = Math.max(ly, ty, top + (logo?.h ?? 0)) + 2;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.3);
  doc.line(M, bottom, PAGE_W - M, bottom);
  doc.setTextColor(0);
  return bottom + 7;
}

function drawFooters(doc: Doc, s: Settings) {
  const n = doc.getNumberOfPages();
  const accent = hexToRgb(s.doc.accentColor);
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 17, PAGE_W - M, PAGE_H - 17);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(s.doc.footerText || '', PAGE_W - 2 * M - 30).slice(0, 3);
    lines.forEach((l: string, k: number) => doc.text(l, M, PAGE_H - 12.5 + k * 3.4));
    if (s.doc.showPageNumbers) doc.text(`${i} / ${n}`, PAGE_W - M, PAGE_H - 12.5, { align: 'right' });
    doc.setFillColor(...accent);
    doc.rect(0, PAGE_H - 1.6, PAGE_W, 1.6, 'F');
  }
  doc.setTextColor(0);
}

/** Letter-spaced text; jsPDF leaves the spacing out when aligning, so place it by hand. */
function spaced(doc: Doc, text: string, x: number, y: number, cs: number, align: 'left' | 'center' | 'right' = 'left') {
  const w = doc.getTextWidth(text) + cs * Math.max(0, text.length - 1);
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  doc.text(text, x0, y, { charSpace: cs });
}

function label(doc: Doc, text: string, x: number, y: number, s?: Settings) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...(s ? hexToRgb(s.doc.accentColor) : MUTED));
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.45 });
}

function partyBlock(doc: Doc, title: string, client: Quote['client'], y: number, right?: { label: string; lines: string[] }): number {
  label(doc, title, M, y);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(client.name || '—', M, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  let yy = y + 10;
  for (const l of [...client.address.split('\n'), client.phone, client.email].filter(Boolean)) {
    doc.text(l, M, yy);
    yy += 3.9;
  }
  if (right) {
    const rx = PAGE_W / 2 + 6;
    label(doc, right.label, rx, y);
    let ry = y + 5.5;
    right.lines.forEach((l, k) => {
      doc.setFont('helvetica', k === 0 ? 'bold' : 'normal');
      doc.setFontSize(k === 0 ? 10.5 : 8.5);
      doc.setTextColor(...(k === 0 ? INK : ([80, 80, 80] as [number, number, number])));
      for (const w of doc.splitTextToSize(l, PAGE_W / 2 - M - 6)) {
        doc.text(w, rx, ry);
        ry += k === 0 ? 4.5 : 3.9;
      }
    });
    yy = Math.max(yy, ry);
  }
  return yy + 5;
}

function totalsBlock(doc: Doc, rows: [string, string, boolean?][], y: number, s: Settings): number {
  const w = 84;
  const x0 = PAGE_W - M - w;
  const accent = hexToRgb(s.doc.accentColor);
  y = ensureSpace(doc, y, rows.length * 6 + 8, s);
  for (const [k, v, strong] of rows) {
    if (strong) {
      y += 1.5;
      doc.setFillColor(...accent);
      doc.roundedRect(x0, y - 5, w, 8.5, 1.6, 1.6, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(k, x0 + 3.5, y + 0.6, { charSpace: 0.3 });
      doc.text(v, PAGE_W - M - 3.5, y + 0.6, { align: 'right' });
      y += 9.5;
    } else {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.text(k, x0 + 3.5, y);
      doc.setTextColor(...INK);
      doc.text(v, PAGE_W - M - 3.5, y, { align: 'right' });
      doc.setDrawColor(...HAIR);
      doc.setLineWidth(0.15);
      doc.line(x0 + 3.5, y + 1.8, PAGE_W - M - 3.5, y + 1.8);
      y += 5.6;
    }
  }
  doc.setTextColor(0);
  return y + 2;
}

function textSection(doc: Doc, title: string, text: string, y: number, s: Settings): number {
  if (!text.trim()) return y;
  doc.setFontSize(8.3);
  const lines = doc.splitTextToSize(text, PAGE_W - 2 * M);
  y = ensureSpace(doc, y, 8 + Math.min(lines.length, 6) * 3.8, s);
  label(doc, title, M, y, s);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(85);
  doc.setFontSize(8.3);
  y += 4.6;
  for (const l of lines) {
    y = ensureSpace(doc, y, 4, s);
    doc.text(l, M, y);
    y += 3.75;
  }
  doc.setTextColor(0);
  return y + 3.5;
}

function signatures(doc: Doc, y: number, s: Settings, left: string, right: string): number {
  if (!s.doc.signatureLine) return y;
  y = ensureSpace(doc, y + 6, 22, s) + 12;
  doc.setDrawColor(170);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + 70, y);
  doc.line(PAGE_W - M - 70, y, PAGE_W - M, y);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(left, M, y + 4);
  doc.text(right, PAGE_W - M - 70, y + 4);
  doc.setTextColor(0);
  return y + 8;
}

/** Shared table look: light header, hairline rows, quiet numbers. */
function tableStyle(s: Settings) {
  const accent = hexToRgb(s.doc.accentColor);
  return {
    theme: 'plain' as const,
    headStyles: { fillColor: [247, 245, 242] as [number, number, number], textColor: accent, fontStyle: 'bold' as const, fontSize: 7.5, cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 } },
    styles: { fontSize: 8.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, valign: 'top' as const, textColor: INK, lineColor: HAIR, lineWidth: { bottom: 0.15 } },
    margin: { left: M, right: M, top: 20, bottom: 24 },
  };
}

/** Draw one unit's front at a given scale. X0 = left edge, Yfloor = page y of the floor line. */
export function drawUnitFront(doc: Doc, u: Unit, cat: Catalog, X0: number, Yfloor: number, sc: number, withDims = true) {
  const yo = u.mount === 'wall' ? u.mountHeight : 0;
  const X = (mm: number) => X0 + mm * sc;
  const Y = (mm: number) => Yfloor - (mm + yo) * sc;
  const e = elevation(u, cat);
  const H = u.height;
  const W = u.width;
  doc.setLineWidth(0.25);
  doc.setDrawColor(40);
  const th = (side: 'left' | 'right') => (u.finishPanels[side].enabled ? cat.boards.find((b) => b.id === u.finishPanels[side].materialId)?.thickness ?? 18 : 0);
  if (u.countertopId || u.topBoardId) {
    doc.setFillColor(200, 200, 200);
    const x0 = -th('left') - u.overhang.left;
    doc.rect(X(x0), Y(H), (W + th('left') + th('right') + u.overhang.left + u.overhang.right) * sc, (H - e.topY) * sc, 'FD');
  }
  for (const side of ['left', 'right'] as const) {
    if (!u.finishPanels[side].enabled) continue;
    doc.setFillColor(215, 200, 180);
    const y0 = u.finishPanels[side].toFloor && u.mount === 'floor' ? 0 : e.baseH;
    doc.rect(side === 'left' ? X(-th('left')) : X(W), Y(e.topY), th(side) * sc, (e.topY - y0) * sc, 'FD');
  }
  doc.setFillColor(250, 246, 240);
  doc.rect(X(0), Y(e.topY), W * sc, (e.topY - e.baseH) * sc, 'FD');
  if (u.mount === 'floor' && u.base === 'plinth' && e.baseH) {
    doc.setFillColor(225, 225, 225);
    doc.rect(X(0), Y(e.baseH), W * sc, e.baseH * sc, 'FD');
  } else if (u.mount === 'floor' && u.base === 'legs' && e.baseH) {
    doc.setFillColor(60, 60, 60);
    for (const lx of [40, W - 40]) doc.rect(X(lx) - 0.5, Y(e.baseH), 1, e.baseH * sc, 'F');
  }
  for (const b of e.bays) if (b.index > 0) doc.line(X(b.x - e.t / 2), Y(e.baseH), X(b.x - e.t / 2), Y(e.topY));
  for (const c of cellRects(u, cat)) {
    if (!c.leaf) continue;
    {
      const s = c.sec;
      doc.setDrawColor(150);
      doc.rect(X(c.x), Y(c.y + c.h), c.w * sc, c.h * sc);
      const front = u.sliding.enabled && s.front !== 'drawer' ? 'open' : s.front;
      const x0 = X(c.x);
      const x1 = X(c.x + c.w);
      const y0 = Y(c.y);
      const y1 = Y(c.y + c.h);
      doc.setDrawColor(110);
      if (front === 'drawer') {
        for (let k = 1; k < s.drawerCount; k++) {
          const yy = y0 + ((y1 - y0) * k) / s.drawerCount;
          doc.line(x0, yy, x1, yy);
        }
      } else if (front === 'door' || front === 'sliding') {
        if (s.doorMaterial !== 'wood') {
          doc.setFillColor(220, 236, 242);
          doc.rect(x0 + 0.5, y1 + 0.5, x1 - x0 - 1, y0 - y1 - 1, 'F');
        }
        if (front === 'sliding') {
          doc.setFontSize(Math.max(5, 9 * Math.min(1, sc * 8)));
          doc.text(s.slide === 'left' ? '<-' : s.slide === 'right' ? '->' : '<->', (x0 + x1) / 2, (y0 + y1) / 2, { align: 'center' });
        } else {
          const ops = s.opening === 'pair' ? (['left', 'right'] as const) : [s.opening];
          const dw = (x1 - x0) / ops.length;
          ops.forEach((op, k) => {
            const dx0 = x0 + k * dw;
            const dx1 = dx0 + dw;
            const ym = (y0 + y1) / 2;
            if (k > 0) doc.line(dx0, y0, dx0, y1);
            doc.setLineDashPattern([0.8, 0.8], 0);
            // lines meet at the hinge side
            if (op === 'left') (doc.line(dx1, y0, dx0, ym), doc.line(dx1, y1, dx0, ym));
            else if (op === 'right') (doc.line(dx0, y0, dx1, ym), doc.line(dx0, y1, dx1, ym));
            else if (op === 'up') (doc.line(dx0, y0, (dx0 + dx1) / 2, y1), doc.line(dx1, y0, (dx0 + dx1) / 2, y1));
            else (doc.line(dx0, y1, (dx0 + dx1) / 2, y0), doc.line(dx1, y1, (dx0 + dx1) / 2, y0));
            doc.setLineDashPattern([], 0);
          });
        }
      } else if (front === 'appliance') {
        doc.setFillColor(40, 40, 44);
        doc.rect(x0 + 0.4, y1 + 0.4, x1 - x0 - 0.8, y0 - y1 - 0.8, 'F');
        const a = cat.appliances.find((x) => x.id === s.applianceId);
        if (a && x1 - x0 > 8) {
          doc.setTextColor(230);
          doc.setFontSize(Math.max(4, Math.min(7, (x1 - x0) * 0.6)));
          doc.text(a.category === 'fridge' ? 'Fridge' : a.category === 'dishwasher' ? 'DW' : a.category === 'microwave' ? 'MW' : a.category === 'oven' ? 'Oven' : a.category, (x0 + x1) / 2, (y0 + y1) / 2, { align: 'center' });
          doc.setTextColor(0);
        }
      } else {
        for (let k = 0; k < s.shelves; k++) {
          const yy = y0 + ((y1 - y0) * (k + 1)) / (s.shelves + 1);
          doc.line(x0 + 0.5, yy, x1 - 0.5, yy);
        }
      }
      if (s.hangingRail && (front === 'open' || u.sliding.enabled)) {
        doc.setLineWidth(0.6);
        doc.line(x0 + 1, y1 + 3, x1 - 1, y1 + 3);
        doc.setLineWidth(0.25);
      }
      doc.setDrawColor(40);
    }
  }
  // hob / sink on top
  for (const t of u.topAppliances) {
    const a = cat.appliances.find((x) => x.id === t.applianceId);
    const b = e.bays[Math.min(t.bay, e.bays.length - 1)];
    if (!a || !b) continue;
    doc.setFillColor(a.category === 'sink' ? 150 : 20, a.category === 'sink' ? 155 : 20, a.category === 'sink' ? 160 : 22);
    const cx = b.x + b.w / 2;
    doc.rect(X(cx - a.width / 2), Y(H) - 1.2, a.width * sc, 1.2, 'F');
  }
  if (u.sliding.enabled) {
    doc.setDrawColor(138, 90, 43);
    doc.setLineDashPattern([2, 1], 0);
    const p = u.sliding.panels;
    for (let k = 1; k < p; k++) doc.line(X((W * k) / p), Y(e.topY), X((W * k) / p), Y(e.baseH));
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(40);
  }
  if (!withDims) return;
  doc.setDrawColor(150);
  doc.setFontSize(7);
  doc.setTextColor(80);
  const dy = Yfloor + 4;
  doc.line(X(0), dy, X(W), dy);
  doc.line(X(0), dy - 1.2, X(0), dy + 1.2);
  doc.line(X(W), dy - 1.2, X(W), dy + 1.2);
  doc.text(`${W}`, (X(0) + X(W)) / 2, dy + 3.2, { align: 'center' });
  const dx = X(0) - 4;
  doc.line(dx, Y(0), dx, Y(H));
  doc.line(dx - 1.2, Y(0), dx + 1.2, Y(0));
  doc.line(dx - 1.2, Y(H), dx + 1.2, Y(H));
  doc.text(`${H}`, dx - 1.5, (Y(0) + Y(H)) / 2, { angle: 90, align: 'center' });
  doc.text(`D ${u.depth}`, X(W), Y(H) - 1.5, { align: 'right' });
  if (yo) doc.text(`${yo} AFF`, X(W) + 1.5, Y(0) + 2);
  doc.setTextColor(0);
}

/** Front elevation of one unit fitted into a box. */
export function drawElevation(doc: Doc, u: Unit, cat: Catalog, x: number, y: number, w: number, h: number) {
  const pad = 9;
  const yo = u.mount === 'wall' ? u.mountHeight : 0;
  const totalH = u.height + yo;
  const sc = Math.min((w - pad * 2) / (u.width + 80), (h - pad * 2) / totalH);
  const ox = x + pad + (w - pad * 2 - u.width * sc) / 2;
  const floor = y + h - pad;
  doc.setDrawColor(200);
  doc.line(x + 3, floor, x + w - 3, floor);
  drawUnitFront(doc, u, cat, ox, floor, sc);
}

/** Front elevation of one wall of a kitchen run. */
export function drawRunLeg(doc: Doc, run: Run, leg: number, cat: Catalog, x: number, y: number, w: number, h: number) {
  const mods = run.legs[leg];
  const L = Math.max(600, legLength(mods));
  const H = Math.max(run.tallHeight, run.wallBottom + run.wallHeight);
  const pad = 9;
  const sc = Math.min((w - pad * 2) / L, (h - pad * 2) / H);
  const ox = x + pad + (w - pad * 2 - L * sc) / 2;
  const floor = y + h - pad;
  doc.setDrawColor(200);
  doc.line(x + 3, floor, x + w - 3, floor);
  let s = 0;
  for (const m of mods) {
    const X0 = ox + s * sc;
    if (m.base) drawUnitFront(doc, m.base, cat, X0, floor, sc, false);
    if (m.wall) drawUnitFront(doc, m.wall, cat, X0, floor, sc, false);
    if (m.kind === 'gap') {
      doc.setDrawColor(160);
      doc.setLineDashPattern([1, 1], 0);
      const a = cat.appliances.find((p) => p.id === m.gapApplianceId);
      const gh = a ? a.height : run.counterHeight;
      doc.rect(X0 + ((m.width - (a?.width ?? m.width)) / 2) * sc, floor - gh * sc, (a?.width ?? m.width) * sc, gh * sc);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6);
      doc.text(m.gapLabel || 'Space', X0 + (m.width * sc) / 2, floor - (gh * sc) / 2, { align: 'center' });
    }
    if (m.hoodId) {
      doc.setFillColor(181, 185, 190);
      const hy = floor - (run.wallBottom + (m.wall ? 0 : 100)) * sc;
      doc.triangle(X0 + m.width * 0.15 * sc, hy, X0 + m.width * 0.85 * sc, hy, X0 + (m.width * sc) / 2, hy - 250 * sc, 'F');
    }
    doc.setFontSize(6);
    doc.setTextColor(90);
    doc.text(`${m.width}`, X0 + (m.width * sc) / 2, floor + 3, { align: 'center' });
    doc.setTextColor(0);
    s += m.width;
  }
  const counter = cat.countertops.find((c) => c.id === run.countertopId);
  if (counter && mods.length) {
    doc.setFillColor(60, 60, 60);
    let s2 = 0;
    for (const m of mods) {
      if (m.kind === 'base') doc.rect(ox + s2 * sc, floor - run.counterHeight * sc, m.width * sc, counter.thickness * sc, 'F');
      s2 += m.width;
    }
  }
  doc.setFontSize(7);
  doc.setTextColor(80);
  doc.text(`${LEG_LABELS[leg]} – ${L}mm`, x + 3, y + 5);
  doc.setTextColor(0);
}

/* =============================================================== quote */

export function quotePdf(q: Quote, calc: QuoteCalc, s: Settings, cat: Catalog): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  const fm = (n: number) => money(n, s.pricing.currency);
  const accent = hexToRgb(s.doc.accentColor);
  let y = drawHeader(doc, s, s.doc.quoteTitle, [
    ['Quote no.', q.number],
    ['Date', fmtDate(q.date)],
    ['Valid until', fmtDate(addDaysISO(q.date, s.doc.quoteValidityDays))],
  ]);
  y = partyBlock(doc, 'Prepared for', q.client, y, { label: 'Project', lines: [q.title, ...(q.notes ? [q.notes] : [])] });

  const desc = (title: string, lines: string[]) => ({ content: `${title}${lines.length ? `\n${lines.join('\n')}` : ''}`, styles: { fontSize: 8.5 } });
  const st = tableStyle(s);
  const sections: { title: string; total: number }[] = [];
  let n = 0;
  /** numbered section heading with a fine rule */
  const heading = (title: string, sub: string) => {
    y = ensureSpace(doc, y, 22, s);
    n += 1;
    doc.setFillColor(...accent);
    doc.circle(M + 3, y - 1.2, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255);
    doc.text(String(n), M + 3, y + 0.1, { align: 'center' });
    doc.setTextColor(...INK);
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), M + 8.5, y + 0.2, { charSpace: 0.6 });
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(sub, PAGE_W - M, y + 0.2, { align: 'right' });
    }
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.35);
    doc.line(M, y + 3, PAGE_W - M, y + 3);
    y += 5;
  };
  const table = (body: RowInput[], subtotal: number, label2: string) => {
    body.push([{ content: '', colSpan: 3, styles: { lineWidth: 0 } }, { content: label2, styles: { halign: 'right', textColor: MUTED, fontSize: 8, lineWidth: 0 } }, { content: fm(subtotal), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0 } }]);
    autoTable(doc, {
      ...st,
      startY: y,
      head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
      body,
      columnStyles: { 0: { cellWidth: 8, textColor: MUTED }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
      didDrawPage: (d) => {
        if (d.pageNumber > 1) drawMiniHeader(doc, s);
      },
    });
    y = lastY(doc, y) + 8;
  };

  // 1. Joinery
  if (calc.items.length) {
    const body: RowInput[] = [];
    if (s.doc.quoteDetail === 'units') {
      calc.items.forEach((it, i) => body.push([String(i + 1), desc(it.name, it.lines), String(it.qty), fm(it.sellEach), fm(it.sell)]));
    } else {
      const mk = 1 + q.markupPercent / 100;
      let i = 1;
      calc.items.forEach((it) => body.push([String(i++), desc(it.name, it.lines), String(it.qty), '', '']));
      for (const l of calc.costLines) if (l.total > 0) body.push([String(i++), `${l.group}: ${l.description}`, `${l.qty} ${l.unit}`, fm(l.unitPrice * mk), fm(l.total * mk)]);
      if (calc.labour) body.push([String(i++), 'Labour & manufacturing', '1', fm(calc.labour * mk), fm(calc.labour * mk)]);
      if (calc.installation) body.push([String(i++), 'Installation', '1', fm(calc.installation * mk), fm(calc.installation * mk)]);
    }
    heading('Joinery', `${calc.items.length} item${calc.items.length === 1 ? '' : 's'}`);
    table(body, calc.unitsSell, 'Joinery subtotal');
    sections.push({ title: 'Joinery', total: calc.unitsSell });
  }

  // 2 / 3. Ceilings and Tiling: one line per room, then add-ons, then what is included
  for (const t of [calc.ceilings, calc.tiling]) {
    if (!t) continue;
    const job = t.trade === 'ceilings' ? q.ceilings : q.tiling;
    const body: RowInput[] = [];
    t.areas.forEach((a, i) => {
      const notes = (job?.areas.find((x) => x.id === a.id)?.notes ?? '').trim();
      body.push([String(i + 1), desc(a.name, [a.summary, ...(notes ? [notes] : [])]), `${a.size} m²`, a.size ? fm((a.sell ?? 0) / a.size) : '', fm(a.sell ?? 0)]);
    });
    t.extras.forEach((e, i) => body.push([String(t.areas.length + i + 1), e.description, `${e.qty}${e.unit ? ` ${e.unit}` : ''}`, fm(e.unitPrice), fm(e.qty * e.unitPrice)]));
    heading(t.title, `${t.size} m²`);
    table(body, t.sell, `${t.title} subtotal`);
    if (s.doc.showTradeMaterials !== false && t.schedule.length) {
      y = ensureSpace(doc, y - 3, 16, s);
      label(doc, `${t.title} – materials included`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(95);
      const items = t.schedule.map((l) => `${l.qty} × ${l.unit} ${l.description}`);
      const colW = (PAGE_W - 2 * M) / 2;
      let yy = y + 4.2;
      for (let k = 0; k < items.length; k += 2) {
        yy = ensureSpace(doc, yy, 4, s);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(95);
        for (let c = 0; c < 2 && k + c < items.length; c++) doc.text(`·  ${doc.splitTextToSize(items[k + c], colW - 6)[0]}`, M + c * colW, yy);
        yy += 3.6;
      }
      y = yy + 5;
    }
    sections.push({ title: t.title, total: t.sell });
  }

  // services, transport and other items
  const tr = s.pricing.transportOptions.find((t) => t.id === q.transportId);
  const other: RowInput[] = [];
  if (calc.transport) other.push([String(other.length + 1), tr ? `Transport – ${tr.name}` : 'Transport', '1', fm(calc.transport), fm(calc.transport)]);
  for (const e of q.extras) other.push([String(other.length + 1), e.description, `${e.qty}${e.unit ? ` ${e.unit}` : ''}`, fm(e.unitPrice), fm(e.qty * e.unitPrice)]);
  if (other.length) {
    heading('Services & other items', '');
    table(other, calc.transport + calc.extras, 'Services subtotal');
    sections.push({ title: 'Services & other items', total: calc.transport + calc.extras });
  }
  if (!sections.length) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('No items quoted yet.', M, y);
    y += 8;
  }

  const supplied = calc.costLines.filter((l) => l.group === 'Appliances' && l.total === 0);
  const rows: [string, string, boolean?][] = sections.length > 1 ? sections.map((x) => [x.title, fm(x.total)] as [string, string]) : [];
  rows.push(['Subtotal', fm(calc.subtotal)]);
  if (calc.discount) rows.push([`Discount${q.discountType === 'percent' ? ` (${q.discountValue}%)` : ''}`, `-${fm(calc.discount)}`]);
  if (q.applyTax) rows.push([`${s.pricing.taxLabel} (${s.pricing.taxRate}%)`, fm(calc.tax)]);
  rows.push(['TOTAL', fm(calc.total), true]);
  y = totalsBlock(doc, rows, y, s);
  if (supplied.length) y = textSection(doc, 'Appliances supplied by client', supplied.map((l) => `• ${l.description} × ${l.qty}`).join('\n'), y + 2, s);

  y = textSection(doc, 'Terms & conditions', s.doc.quoteTerms, y + 2, s);
  y = textSection(doc, 'Banking details', s.doc.bankDetails, y, s);
  y = signatures(doc, y, s, 'Client acceptance & date', `For ${s.company.name}`);

  // design pages
  if ((s.doc.showRenders || s.doc.showElevations) && calc.items.length) {
    doc.addPage();
    y = drawMiniHeader(doc, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Design drawings', M, y + 2);
    y += 8;
    const both = s.doc.showRenders && s.doc.showElevations;
    for (const it of calc.items) {
      const isRun = it.kind === 'run' && it.run && it.runBuild;
      const blockH = 82;
      y = ensureSpace(doc, y, blockH + 8, s);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${it.name}${it.qty > 1 ? ` × ${it.qty}` : ''}`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(it.unit ? `${it.unit.width} × ${it.unit.height} × ${it.unit.depth} mm` : it.lines[0] ?? '', PAGE_W - M, y, { align: 'right' });
      doc.setTextColor(0);
      y += 3;
      doc.setDrawColor(225);
      if (isRun) {
        // full-width render, then one elevation per wall
        if (s.doc.showRenders) {
          const img = renderRunImage(it.run!, it.runBuild!, cat, 1400, 760, 'image/jpeg');
          doc.roundedRect(M, y, PAGE_W - 2 * M, blockH, 2, 2, 'S');
          if (img) {
            const ih = blockH - 4;
            const iw = Math.min(PAGE_W - 2 * M - 4, (ih * 1400) / 760);
            doc.addImage(img, 'JPEG', M + (PAGE_W - 2 * M - iw) / 2, y + 2, iw, ih);
          }
          y += blockH + 4;
        }
        if (s.doc.showElevations) {
          for (let leg = 0; leg < activeLegs(it.run!); leg++) {
            y = ensureSpace(doc, y, 64, s);
            doc.roundedRect(M, y, PAGE_W - 2 * M, 60, 2, 2, 'S');
            drawRunLeg(doc, it.run!, leg, cat, M, y, PAGE_W - 2 * M, 60);
            y += 64;
          }
        }
        y += 5;
        continue;
      }
      if (it.kind === 'assembly' && it.assembly && it.assemblyBuild) {
        // 3D view and the top view (shows which way every cabinet faces)
        const views = [s.doc.showRenders ? ('3d' as const) : null, s.doc.showElevations ? ('top' as const) : null, s.doc.showElevations && it.assembly.pieces.some((p) => p.rot === 180) ? ('back' as const) : null].filter(Boolean) as ('3d' | 'top' | 'back')[];
        const w = (PAGE_W - 2 * M - 6 * (views.length - 1)) / Math.max(1, views.length);
        views.forEach((v, k) => {
          const img = renderAssemblyImage(it.assembly!, it.assemblyBuild!, cat, 1000, 760, 'image/jpeg', v);
          const x = M + k * (w + 6);
          doc.roundedRect(x, y, w, blockH, 2, 2, 'S');
          if (img) {
            const ih = blockH - 8;
            const iw = Math.min(w - 4, (ih * 1000) / 760);
            doc.addImage(img, 'JPEG', x + (w - iw) / 2, y + 2, iw, ih);
          }
          doc.setFontSize(7);
          doc.setTextColor(110);
          doc.text(v === '3d' ? '3D view' : v === 'top' ? 'Top view (front at the bottom)' : 'Back view', x + w / 2, y + blockH - 2, { align: 'center' });
          doc.setTextColor(0);
        });
        y += blockH + 9;
        continue;
      }
      const colW = both ? (PAGE_W - 2 * M - 6) / 2 : PAGE_W - 2 * M;
      if (s.doc.showRenders && it.unit && it.build) {
        const img = renderUnitImage(it.unit, it.build, cat, 900, 700, 'image/jpeg');
        doc.roundedRect(M, y, colW, blockH, 2, 2, 'S');
        if (img) {
          const ih = blockH - 4;
          const iw = Math.min(colW - 4, (ih * 900) / 700);
          doc.addImage(img, 'JPEG', M + (colW - iw) / 2, y + 2, iw, ih);
        }
      }
      if (s.doc.showElevations && it.unit) {
        const ex = both ? M + colW + 6 : M;
        doc.roundedRect(ex, y, colW, blockH, 2, 2, 'S');
        drawElevation(doc, it.unit, cat, ex, y, colW, blockH);
      }
      y += blockH + 9;
    }
  }

  // room visualisation
  if (q.room && calc.items.length) {
    doc.addPage();
    y = drawMiniHeader(doc, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Room visualisation', M, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    const ext = roomExtents(q.room);
    doc.text(`${Math.round(ext.x1 - ext.x0)} × ${Math.round(ext.z1 - ext.z0)} mm · ${q.room.walls.length} walls · up to ${ext.h} mm high`, PAGE_W - M, y + 2, { align: 'right' });
    doc.setTextColor(0);
    y += 6;
    const img = renderRoomImage(q.room, calc.items, cat, 1500, 950, 'image/jpeg');
    if (img) {
      const w = PAGE_W - 2 * M;
      doc.addImage(img, 'JPEG', M, y, w, (w * 950) / 1500);
      y += (w * 950) / 1500 + 4;
    }
    drawRoomPlan(doc, q.room, calc.items, cat, M, y, PAGE_W - 2 * M, PAGE_H - 26 - y);
  }

  // attached designs
  const att = q.attachments.filter((a) => a.includeInPdf);
  for (let i = 0; i < att.length; i++) {
    const a = att[i];
    const slot = i % 2;
    if (slot === 0) {
      doc.addPage();
      y = drawMiniHeader(doc, s);
      if (i === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Attached designs', M, y + 2);
        y += 6;
      }
    }
    try {
      const props = doc.getImageProperties(a.dataUrl);
      const maxW = PAGE_W - 2 * M;
      const maxH = 112;
      const r = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * r;
      const h = props.height * r;
      doc.addImage(a.dataUrl, imgFormat(a.dataUrl), M + (maxW - w) / 2, y + 2, w, h);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80);
      doc.text(a.caption || a.name, PAGE_W / 2, y + h + 7, { align: 'center' });
      doc.setTextColor(0);
      y += maxH + 14;
    } catch {
      /* skip unreadable image */
    }
  }
  drawFooters(doc, s);
  return doc;
}

/** Dimensioned plan of the room with openings and item footprints. */
export function drawRoomPlan(doc: Doc, room: Room, items: ItemPrice[], cat: Catalog, x: number, y: number, w: number, h: number) {
  const T = room.wallThickness;
  // fit the walls and every placed item (items may sit outside the walls)
  const e = { ...roomExtents(room) };
  for (const pl of room.placements) {
    const it = items.find((i) => i.id === pl.itemId);
    if (!it) continue;
    for (const [px, pz] of footprints(it, cat, pl).flat()) {
      e.x0 = Math.min(e.x0, px);
      e.x1 = Math.max(e.x1, px);
      e.z0 = Math.min(e.z0, pz);
      e.z1 = Math.max(e.z1, pz);
    }
  }
  const pad = 12;
  const sc = Math.min((w - 2 * pad) / (e.x1 - e.x0 + 2 * T), (h - 2 * pad) / (e.z1 - e.z0 + 2 * T));
  const ox = x + (w - (e.x1 - e.x0) * sc) / 2 - e.x0 * sc;
  const oy = y + (h - (e.z1 - e.z0) * sc) / 2 - e.z0 * sc;
  const P = (px: number, pz: number): [number, number] => [ox + px * sc, oy + pz * sc];
  doc.setDrawColor(225);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  const verts = vertices(room);
  const quad = (pts: [number, number][], style: 'F' | 'FD' | 'S') => {
    const q = pts.map(([a, b]) => P(a, b));
    doc.lines(q.slice(1).map((pt, i) => [pt[0] - q[i][0], pt[1] - q[i][1]]), q[0][0], q[0][1], [1, 1], style, true);
  };
  room.walls.forEach((wall, i) => {
    const [dx, dz] = wallDir(wall);
    const [nx, nz] = inwardNormal(room, i);
    const [sx, sz] = verts[i];
    const seg = (u0: number, u1: number, v0 = 0, v1 = T): [number, number][] => [
      [sx + dx * u0 - nx * v0, sz + dz * u0 - nz * v0],
      [sx + dx * u1 - nx * v0, sz + dz * u1 - nz * v0],
      [sx + dx * u1 - nx * v1, sz + dz * u1 - nz * v1],
      [sx + dx * u0 - nx * v1, sz + dz * u0 - nz * v1],
    ];
    if (wall.visible) doc.setFillColor(87, 83, 78);
    else doc.setFillColor(200, 196, 190);
    quad(seg(0, wall.length), 'F');
    for (const o of room.openings.filter((op) => op.wall === i)) {
      doc.setFillColor(255, 255, 255);
      quad(seg(o.offset, o.offset + o.width), 'F');
      if (o.kind === 'window') {
        doc.setDrawColor(56, 189, 248);
        doc.setLineWidth(0.5);
        const [a1, b1] = P(sx + dx * o.offset - (nx * T) / 2, sz + dz * o.offset - (nz * T) / 2);
        const [a2, b2] = P(sx + dx * (o.offset + o.width) - (nx * T) / 2, sz + dz * (o.offset + o.width) - (nz * T) / 2);
        doc.line(a1, b1, a2, b2);
        doc.setLineWidth(0.2);
      }
      if (o.kind === 'opening' && o.beam) {
        doc.setDrawColor(120);
        doc.setLineDashPattern([1, 1], 0);
        quad(seg(o.offset, o.offset + o.width, -300, 0), 'S');
        doc.setLineDashPattern([], 0);
      }
      doc.setFontSize(6);
      doc.setTextColor(90);
      const [lx, lz] = P(sx + dx * (o.offset + o.width / 2) - nx * (T + 120), sz + dz * (o.offset + o.width / 2) - nz * (T + 120));
      doc.text(`${o.label || o.kind} ${o.width}${o.kind === 'opening' && o.beam ? ' (RC beam)' : ''}`, lx, lz, { align: 'center' });
    }
  });
  // joinery outlines read from the client's plan
  doc.setDrawColor(124, 58, 237);
  doc.setLineDashPattern([1, 0.8], 0);
  doc.setFontSize(5.5);
  doc.setTextColor(109, 40, 217);
  for (const f of room.fixtures ?? []) {
    const poly = [
      [0, 0],
      [f.w, 0],
      [f.w, f.d],
      [0, f.d],
    ].map(([a, b]) => placeXZ(a, b, { itemId: '', x: f.x, z: f.z, rot: f.rot }));
    quad(poly, 'S');
    const c = poly.reduce((acc, q) => [acc[0] + q[0] / 4, acc[1] + q[1] / 4], [0, 0]);
    const [cx, cz] = P(c[0], c[1]);
    doc.text(`plan: ${f.label}`.slice(0, 30), cx, cz + 3, { align: 'center' });
  }
  doc.setLineDashPattern([], 0);
  doc.setTextColor(30);
  doc.setDrawColor(87, 83, 78);
  doc.setFontSize(6);
  for (const p of room.placements) {
    const it = items.find((i) => i.id === p.itemId);
    if (!it) continue;
    const polys = footprints(it, cat, p);
    for (const poly of polys) {
      if (it.kind === 'run') doc.setFillColor(221, 214, 254);
      else if (it.kind === 'assembly' && !it.assembly?.pieces.some((x) => x.unit)) doc.setFillColor(186, 230, 253);
      else doc.setFillColor(233, 201, 159);
      quad(poly, 'FD');
    }
    const allPts = polys.flat();
    const c = allPts.reduce((acc, q) => [acc[0] + q[0] / allPts.length, acc[1] + q[1] / allPts.length], [0, 0]);
    const [cx, cz] = P(c[0], c[1]);
    doc.text(it.name.slice(0, 28), cx, cz, { align: 'center' });
  }
  // wall length labels outside each wall, drawn last so items never hide them
  doc.setFontSize(7);
  doc.setTextColor(60);
  room.walls.forEach((wall, i) => {
    const [dx, dz] = wallDir(wall);
    const [nx, nz] = inwardNormal(room, i);
    const [sx, sz] = verts[i];
    const [tx, tz] = P(sx + (dx * wall.length) / 2 - nx * (T + 330), sz + (dz * wall.length) / 2 - nz * (T + 330));
    doc.text(`W${i + 1} · ${wall.length}`, tx, tz, { align: 'center' });
  });
  doc.setTextColor(0);
}

/* ============================================================ workshop */

function drawSheet(doc: Doc, plan: BoardPlan, idx: number, x: number, y: number, w: number): number {
  const L = plan.material.sheetLength;
  const W = plan.material.sheetWidth;
  const sc = w / L;
  const h = W * sc;
  const s = plan.sheets[idx];
  doc.setFillColor(200, 200, 200);
  doc.setDrawColor(120);
  doc.rect(x, y, w, h, 'FD');
  doc.setFillColor(254, 249, 195);
  for (const o of s.offcuts) doc.rect(x + o.x * sc, y + o.y * sc, o.w * sc, o.h * sc, 'F');
  doc.setFillColor(240, 222, 196);
  doc.setFontSize(6);
  for (const p of s.placements) {
    doc.rect(x + p.x * sc, y + p.y * sc, p.l * sc, p.w * sc, 'FD');
    if (p.l * sc > 12 && p.w * sc > 5) {
      const label = p.rotated ? `${p.piece.width}×${p.piece.length}` : `${p.piece.length}×${p.piece.width}`;
      doc.text(label, x + (p.x + p.l / 2) * sc, y + (p.y + p.w / 2) * sc + 1, { align: 'center' });
    }
  }
  return h;
}

export function workshopPdf(q: Quote, calc: QuoteCalc, s: Settings, cat: Catalog): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  let y = drawHeader(doc, s, 'CUT LIST', [
    ['Job', q.number],
    ['Date', fmtDate(q.date)],
  ]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${q.title} — ${q.client.name || ''}`, M, y);
  y += 4;
  const board = (id: string | null) => cat.boards.find((b) => b.id === id);

  for (const u of calc.entries) {
    if (!u.build.parts.length && !u.build.hardware.length) continue;
    const rows: RowInput[] = u.build.parts.map((p) => [
      p.name,
      String(p.length),
      String(p.width),
      String(p.thickness),
      String(p.qty * u.qty),
      p.kind === 'board' ? board(p.materialId)?.name ?? '' : p.kind === 'glass' ? cat.glass.find((g) => g.id === p.materialId)?.name ?? 'Glass' : cat.countertops.find((c) => c.id === p.materialId)?.name ?? '',
      p.edgeLength ? (p.edgeLength * p.qty * u.qty).toFixed(2) : '',
    ]);
    autoTable(doc, {
      startY: y + 3,
      head: [[{ content: `${u.name} × ${u.qty}${u.unit ? `   (${u.unit.width}×${u.unit.height}×${u.unit.depth})` : ''}`, colSpan: 7 }], ['Part', 'Length', 'Width', 'Thk', 'Qty', 'Material', 'Edge m']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: hexToRgb(s.doc.accentColor), fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.3 },
      margin: { left: M, right: M, top: 18, bottom: 24 },
      didDrawPage: (d) => {
        if (d.pageNumber > 1) drawMiniHeader(doc, s);
      },
    });
    y = lastY(doc, y) + 2;
    const hw: RowInput[] = u.build.hardware.map((h) => {
      const a = cat.accessories.find((x) => x.id === h.accessoryId);
      return [a ? `${a.name} ${a.size}` : h.accessoryId, `${+(h.qty * u.qty).toFixed(2)} ${a?.unit ?? ''}`, h.reason];
    });
    if (hw.length) {
      autoTable(doc, {
        startY: y,
        head: [['Hardware', 'Qty', 'Use']],
        body: hw,
        theme: 'plain',
        headStyles: { fontSize: 7.5, textColor: 90 },
        styles: { fontSize: 7.5, cellPadding: 1 },
        margin: { left: M, right: M, top: 18, bottom: 24 },
      });
      y = lastY(doc, y) + 3;
    }
  }

  // purchasing summary
  y = ensureSpace(doc, y + 4, 30, s);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Materials to purchase', M, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['Group', 'Item', 'Qty', 'Unit', 'Cost', 'Note']],
    body: calc.costLines.map((l) => [l.group, l.description, String(l.qty), l.unit, money(l.total, s.pricing.currency), l.note ?? '']),
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(s.doc.accentColor), fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.4 },
    margin: { left: M, right: M, top: 18, bottom: 24 },
  });
  y = lastY(doc, y) + 6;

  // parts too big for the stock: how they are split and joined
  if (calc.joins.length) {
    y = ensureSpace(doc, y, 20, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Joined parts (bigger than the board)', M, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Qty', 'Part', 'Size', 'Cut as', 'Joint method']],
      body: calc.joins.map((j) => [String(j.qty), `${j.item} – ${j.part} (${j.material})`, `${j.original.length} × ${j.original.width}`, `${j.pieces.map((p) => `${p.length}×${p.width}`).join(' + ')}${j.cleats.length ? ` + ${j.cleats.length} cleat(s)` : ''}`, j.method]),
      theme: 'striped',
      headStyles: { fillColor: hexToRgb(s.doc.accentColor), fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.2 },
      columnStyles: { 4: { cellWidth: 70 } },
      margin: { left: M, right: M, top: 18, bottom: 24 },
    });
    y = lastY(doc, y) + 6;
  }

  // sheet layouts
  for (const plan of calc.boardPlans) {
    for (let i = 0; i < plan.sheets.length; i++) {
      const w = PAGE_W - 2 * M;
      const h = (plan.material.sheetWidth / plan.material.sheetLength) * w;
      y = ensureSpace(doc, y, h + 14, s);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const sh = plan.sheets[i];
      doc.text(`${plan.material.name} — sheet ${i + 1}/${plan.sheets.length}  (${Math.round((sh.usedArea / plan.sheetArea) * 100)}% used, waste ${((sh.wasteArea) / 1e6).toFixed(2)} m²)`, M, y);
      y += 2;
      y += drawSheet(doc, plan, i, M, y, w) + 8;
    }
  }
  for (const b of calc.barPlans) {
    y = ensureSpace(doc, y, 10 + b.bars.length * 5, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${b.profile.name} — cut plan`, M, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    b.bars.forEach((bar, i) => {
      doc.text(`Length ${i + 1}: ${bar.join(' + ')} mm`, M, y);
      y += 4.5;
    });
    y += 3;
  }
  // accessory packs summary
  drawFooters(doc, s);
  return doc;
}

/* ============================================================= invoice */

export function invoicePdf(inv: Invoice, s: Settings): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  const c = calculateInvoice(inv, s);
  const fm = (n: number) => money(n, s.pricing.currency);
  const meta: [string, string][] = [
    ['Invoice no.', inv.number],
    ['Date', fmtDate(inv.date)],
    ['Due date', fmtDate(inv.dueDate)],
  ];
  if (inv.quoteNumber) meta.push(['Quote ref.', inv.quoteNumber]);
  let y = drawHeader(doc, s, s.doc.invoiceTitle, meta);
  y = partyBlock(doc, 'Bill to', inv.client, y, { label: 'Status', lines: [c.status.toUpperCase()] });
  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Unit price', 'Amount']],
    body: inv.lines.map((l, i) => [String(i + 1), l.kind === 'deviation' ? `${l.credit || l.unitPrice < 0 ? 'Credit' : 'Extra'} (deviation from quotation): ${l.description}${l.reason ? ` — ${l.reason}` : ''}` : l.description, String(l.qty), fm(l.unitPrice), fm(l.qty * l.unitPrice)]),
    ...tableStyle(s),
    columnStyles: { 0: { cellWidth: 8, textColor: MUTED }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) drawMiniHeader(doc, s);
    },
  });
  y = lastY(doc, y) + 6;
  const rows: [string, string, boolean?][] = [['Subtotal', fm(c.subtotal)]];
  if (c.discount) rows.push([`Discount${inv.discountType === 'percent' ? ` (${inv.discountValue}%)` : ''}`, `-${fm(c.discount)}`]);
  if (inv.applyTax) rows.push([`${s.pricing.taxLabel} (${s.pricing.taxRate}%)`, fm(c.tax)]);
  rows.push(['TOTAL', fm(c.total), true]);
  if (c.depositDue > 0) rows.push([`Deposit required${inv.depositType === 'percent' ? ` (${inv.depositValue}%)` : ''}`, fm(c.depositDue)]);
  rows.push(['Paid to date', fm(c.paid)]);
  rows.push(['BALANCE DUE', fm(Math.max(0, c.balance)), true]);
  y = totalsBlock(doc, rows, y, s);

  if (inv.payments.length) {
    y = ensureSpace(doc, y, 20, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PAYMENTS RECEIVED', M, y);
    autoTable(doc, {
      startY: y + 2,
      head: [['Date', 'Receipt', 'Method', 'Reference', 'Amount']],
      body: [...inv.payments].sort((a, b) => a.date.localeCompare(b.date)).map((p) => [fmtDate(p.date), p.receiptNumber, p.method, p.reference, fm(p.amount)]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.4 },
      headStyles: { textColor: 100 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: M, right: M, top: 18, bottom: 24 },
    });
    y = lastY(doc, y) + 5;
  }
  y = textSection(doc, 'Notes', inv.notes, y, s);
  y = textSection(doc, 'Terms', s.doc.invoiceTerms, y, s);
  y = textSection(doc, 'Banking details', s.doc.bankDetails, y, s);
  signatures(doc, y, s, 'Received by', `For ${s.company.name}`);
  drawFooters(doc, s);
  return doc;
}

/* ============================================================= receipt */

export function receiptPdf(inv: Invoice, pay: Payment, s: Settings): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  const fm = (n: number) => money(n, s.pricing.currency);
  const { paidToDate, balance, total } = balanceAfterPayment(inv, s, pay.id);
  let y = drawHeader(doc, s, s.doc.receiptTitle, [
    ['Receipt no.', pay.receiptNumber],
    ['Date', fmtDate(pay.date)],
    ['Invoice', inv.number],
  ]);
  y = partyBlock(doc, 'Received from', inv.client, y);
  const accent = hexToRgb(s.doc.accentColor);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(M, y, PAGE_W - 2 * M, 22, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.text('AMOUNT RECEIVED', M + 6, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(fm(pay.amount), PAGE_W - M - 6, y + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${pay.method}${pay.reference ? ` · Ref ${pay.reference}` : ''}`, M + 6, y + 16);
  doc.setTextColor(0);
  y += 32;
  autoTable(doc, {
    startY: y,
    body: [
      ['Invoice total', fm(total)],
      ['Previously paid', fm(paidToDate - pay.amount)],
      ['This payment', fm(pay.amount)],
      ['Total paid to date', fm(paidToDate)],
      [{ content: balance <= 0.004 ? 'Balance remaining — PAID IN FULL' : 'Balance remaining', styles: { fontStyle: 'bold' } }, { content: fm(Math.max(0, balance)), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: M, right: M },
  });
  y = lastY(doc, y) + 8;
  y = textSection(doc, 'Note', s.doc.receiptNote, y, s);
  signatures(doc, y, s, 'Received by', 'Customer');
  drawFooters(doc, s);
  return doc;
}

/* ============================================================= output */

/** Hand a finished PDF to the export sheet (download to phone / share). */
export async function saveOrShare(doc: jsPDF, filename: string): Promise<void> {
  usePdfExport.setState({ doc, filename: filename.replace(/[^\w.-]+/g, '_'), result: null });
}

/** Save a PDF to the device: Documents/En-Quote on Android, Files on iPhone, a save dialog on Windows, Downloads in a browser. */
export async function downloadPdf(doc: jsPDF, filename: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return window.woodquoteDesktop ? `Choose where to save ${filename} (starts in Documents\\En-Quote)` : `Downloaded ${filename}`;
  }
  const data = doc.output('datauristring').split(',')[1];
  if (Capacitor.getPlatform() === 'ios') {
    // the app's Documents folder shows in the Files app
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Documents, recursive: true });
    return `Saved to Files › On My iPhone › En-Quote › ${filename}`;
  }
  try {
    await Filesystem.requestPermissions().catch(() => undefined);
    await Filesystem.writeFile({ path: `En-Quote/${filename}`, data, directory: Directory.Documents, recursive: true });
    return `Saved to Documents/En-Quote/${filename}`;
  } catch {
    const res = await Filesystem.writeFile({ path: `En-Quote/${filename}`, data, directory: Directory.External, recursive: true });
    return `Saved to ${res.uri.replace('file://', '')}`;
  }
}

export async function sharePdf(doc: jsPDF, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const data = doc.output('datauristring').split(',')[1];
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Share PDF' });
    return;
  }
  if (window.woodquoteDesktop) {
    // Windows app: open in the default PDF viewer to print or email it
    await window.woodquoteDesktop.openFile(filename, doc.output('arraybuffer'));
    return;
  }
  const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: filename });
  else window.open(URL.createObjectURL(file), '_blank');
}

export async function shareTextFile(filename: string, text: string, mime: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Save backup' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const accessoryPacksLabel = (cat: Catalog, accessoryId: string, qty: number): string => {
  const a = cat.accessories.find((x) => x.id === accessoryId);
  if (!a) return String(qty);
  return a.packQty > 1 && a.unit !== 'm' ? `${Math.ceil(qty)} pcs (${accessoryPacks(a, qty)} × ${a.packQty})` : `${+qty.toFixed(2)} ${a.unit}`;
};
