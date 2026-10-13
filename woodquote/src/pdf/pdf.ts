import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { describeUnit } from '../lib/describe';
import { elevation } from '../lib/generate';
import type { BoardPlan } from '../lib/optimizer';
import { accessoryPacks, balanceAfterPayment, calculateInvoice, type QuoteCalc } from '../lib/pricing';
import type { Catalog, Invoice, Payment, Quote, Settings, Unit } from '../lib/types';
import { addDaysISO, fmtDate, money } from '../lib/util';
import { renderUnitImage } from '../render/scene';

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

function drawMiniHeader(doc: Doc, s: Settings): number {
  const accent = hexToRgb(s.doc.accentColor);
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(s.company.name, M, 10);
  doc.setTextColor(0);
  return 18;
}

/** Customisable letterhead. Returns y below header. */
function drawHeader(doc: Doc, s: Settings, title: string, meta: [string, string][]): number {
  const accent = hexToRgb(s.doc.accentColor);
  const c = s.company;
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, 4, 'F');

  let y = 12;
  const pos = s.doc.logoPosition;
  let textX = M;
  let align: 'left' | 'center' | 'right' = 'left';
  let logoH = 0;
  if (c.logo) {
    try {
      const props = doc.getImageProperties(c.logo);
      const h = 20;
      const w = Math.min(50, (props.width / props.height) * h);
      const x = pos === 'left' ? M : pos === 'center' ? PAGE_W / 2 - w / 2 : PAGE_W - M - w;
      doc.addImage(c.logo, imgFormat(c.logo), x, y - 2, w, h);
      logoH = h;
      if (pos === 'left') textX = M + w + 5;
    } catch {
      /* ignore broken logo */
    }
  }
  if (pos === 'center') {
    textX = PAGE_W / 2;
    align = 'center';
    y += logoH ? logoH + 4 : 0;
  } else if (pos === 'right') {
    textX = M;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...accent);
  doc.text(c.name, textX, y + 4, { align });
  doc.setTextColor(90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let ly = y + 9;
  const lines = [c.tagline, ...c.address.split('\n'), [c.phone, c.email].filter(Boolean).join('  ·  '), c.website, c.taxNumber ? `Tax no: ${c.taxNumber}` : '', ...s.doc.headerFields.filter((f) => f.label || f.value).map((f) => `${f.label}${f.label && f.value ? ': ' : ''}${f.value}`)].filter(Boolean);
  for (const l of lines) {
    doc.text(l, textX, ly, { align });
    ly += 3.8;
  }
  if (s.doc.headerText) {
    doc.setFont('helvetica', 'italic');
    for (const l of doc.splitTextToSize(s.doc.headerText, pos === 'center' ? 160 : 100)) {
      doc.text(l, textX, ly, { align });
      ly += 3.8;
    }
    doc.setFont('helvetica', 'normal');
  }

  // title + meta box
  const boxTop = pos === 'center' ? ly + 2 : 12;
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, PAGE_W - M, boxTop + 6, { align: 'right' });
  doc.setFontSize(9);
  let my = boxTop + 12;
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(k, PAGE_W - M - 34, my, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(v, PAGE_W - M, my, { align: 'right' });
    my += 4.5;
  }
  const bottom = Math.max(ly, my, y + logoH) + 3;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(M, bottom, PAGE_W - M, bottom);
  doc.setTextColor(0);
  return bottom + 6;
}

function drawFooters(doc: Doc, s: Settings) {
  const n = doc.getNumberOfPages();
  const accent = hexToRgb(s.doc.accentColor);
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 18, PAGE_W - M, PAGE_H - 18);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(s.doc.footerText || '', PAGE_W - 2 * M - 25).slice(0, 3);
    lines.forEach((l: string, k: number) => doc.text(l, M, PAGE_H - 13 + k * 3.6));
    if (s.doc.showPageNumbers) doc.text(`Page ${i} of ${n}`, PAGE_W - M, PAGE_H - 13, { align: 'right' });
    doc.setFillColor(...accent);
    doc.rect(0, PAGE_H - 3, PAGE_W, 3, 'F');
  }
  doc.setTextColor(0);
}

function partyBlock(doc: Doc, label: string, client: Quote['client'], y: number, right?: { label: string; lines: string[] }): number {
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), M, y);
  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.text(client.name || '—', M, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let yy = y + 9.5;
  for (const l of [...client.address.split('\n'), client.phone, client.email].filter(Boolean)) {
    doc.text(l, M, yy);
    yy += 4;
  }
  if (right) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'bold');
    doc.text(right.label.toUpperCase(), PAGE_W / 2 + 10, y);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let ry = y + 5;
    for (const l of right.lines) {
      for (const w of doc.splitTextToSize(l, PAGE_W / 2 - 24)) {
        doc.text(w, PAGE_W / 2 + 10, ry);
        ry += 4;
      }
    }
    yy = Math.max(yy, ry);
  }
  return yy + 4;
}

function totalsBlock(doc: Doc, rows: [string, string, boolean?][], y: number, s: Settings): number {
  const x0 = PAGE_W - M - 80;
  const accent = hexToRgb(s.doc.accentColor);
  y = ensureSpace(doc, y, rows.length * 6 + 6, s);
  for (const [k, v, strong] of rows) {
    if (strong) {
      doc.setFillColor(...accent);
      doc.rect(x0 - 2, y - 4.2, 82, 7, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
    } else {
      doc.setTextColor(60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
    }
    doc.text(k, x0, y);
    doc.text(v, PAGE_W - M - 1, y, { align: 'right' });
    y += strong ? 8 : 5.5;
  }
  doc.setTextColor(0);
  return y + 2;
}

function textSection(doc: Doc, title: string, text: string, y: number, s: Settings): number {
  if (!text.trim()) return y;
  const lines = doc.splitTextToSize(text, PAGE_W - 2 * M);
  y = ensureSpace(doc, y, 8 + lines.length * 4, s);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(s.doc.accentColor));
  doc.text(title.toUpperCase(), M, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.setFontSize(8.5);
  y += 4.5;
  for (const l of lines) {
    y = ensureSpace(doc, y, 4, s);
    doc.text(l, M, y);
    y += 3.9;
  }
  doc.setTextColor(0);
  return y + 3;
}

function signatures(doc: Doc, y: number, s: Settings, left: string, right: string): number {
  if (!s.doc.signatureLine) return y;
  y = ensureSpace(doc, y + 6, 22, s) + 12;
  doc.setDrawColor(150);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + 70, y);
  doc.line(PAGE_W - M - 70, y, PAGE_W - M, y);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(left, M, y + 4);
  doc.text(right, PAGE_W - M - 70, y + 4);
  doc.setTextColor(0);
  return y + 8;
}

/** Front elevation with dimensions drawn with vector primitives. */
export function drawElevation(doc: Doc, u: Unit, cat: Catalog, x: number, y: number, w: number, h: number) {
  const pad = 9;
  const sc = Math.min((w - pad * 2) / u.width, (h - pad * 2) / u.height);
  const ox = x + pad + (w - pad * 2 - u.width * sc) / 2;
  const oy = y + pad + (h - pad * 2 - u.height * sc) / 2;
  const X = (mm: number) => ox + mm * sc;
  const Y = (mm: number) => oy + (u.height - mm) * sc; // flip y
  const e = elevation(u, cat);
  doc.setLineWidth(0.25);
  doc.setDrawColor(40);
  // countertop
  if (u.countertopId) {
    doc.setFillColor(200, 200, 200);
    doc.rect(X(0), Y(u.height), u.width * sc, (u.height - e.topY) * sc, 'FD');
  }
  // carcass outline
  doc.setFillColor(250, 246, 240);
  doc.rect(X(0), Y(e.topY), u.width * sc, (e.topY - e.baseH) * sc, 'FD');
  if (u.base === 'plinth' && e.baseH) {
    doc.setFillColor(225, 225, 225);
    doc.rect(X(0), Y(e.baseH), u.width * sc, e.baseH * sc, 'FD');
  } else if (u.base === 'legs' && e.baseH) {
    doc.setFillColor(60, 60, 60);
    for (const lx of [40, u.width - 40]) doc.rect(X(lx) - 0.6, Y(e.baseH), 1.2, e.baseH * sc, 'F');
  }
  for (const b of e.bays) {
    const bay = u.bays[b.index];
    if (b.index > 0) doc.line(X(b.x - e.t / 2), Y(e.baseH), X(b.x - e.t / 2), Y(e.topY));
    for (const sct of b.sections) {
      const s = bay.sections[sct.index];
      if (sct.index > 0) doc.line(X(b.x), Y(sct.y - e.t / 2), X(b.x + b.w), Y(sct.y - e.t / 2));
      const front = u.sliding.enabled && s.front !== 'drawer' ? 'open' : s.front;
      const x0 = X(b.x);
      const x1 = X(b.x + b.w);
      const y0 = Y(sct.y);
      const y1 = Y(sct.y + sct.h);
      doc.setDrawColor(110);
      if (front === 'drawer') {
        for (let k = 1; k < s.drawerCount; k++) {
          const yy = y0 + ((y1 - y0) * k) / s.drawerCount;
          doc.line(x0, yy, x1, yy);
        }
        for (let k = 0; k < s.drawerCount; k++) {
          const cy = y0 + ((y1 - y0) * (k + 1)) / s.drawerCount - ((y1 - y0) / s.drawerCount) * 0.75;
          doc.line((x0 + x1) / 2 - 3, cy, (x0 + x1) / 2 + 3, cy);
        }
      } else if (front === 'door' || front === 'glassDoor') {
        if (front === 'glassDoor') {
          doc.setFillColor(220, 236, 242);
          doc.rect(x0 + 1, y1 + 1, x1 - x0 - 2, y0 - y1 - 2, 'F');
        }
        const dw = (x1 - x0) / s.doorCount;
        for (let k = 0; k < s.doorCount; k++) {
          const dx0 = x0 + k * dw;
          const dx1 = dx0 + dw;
          if (k > 0) doc.line(dx0, y0, dx0, y1);
          // opening triangle: apex on handle side
          const hingeLeft = s.doorCount === 2 ? k === 0 : b.index < e.bays.length / 2;
          doc.setLineDashPattern([0.8, 0.8], 0);
          if (hingeLeft) {
            doc.line(dx0, y0, dx1, (y0 + y1) / 2);
            doc.line(dx0, y1, dx1, (y0 + y1) / 2);
          } else {
            doc.line(dx1, y0, dx0, (y0 + y1) / 2);
            doc.line(dx1, y1, dx0, (y0 + y1) / 2);
          }
          doc.setLineDashPattern([], 0);
        }
      } else if (front === 'flap') {
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(x0, y1, (x0 + x1) / 2, y0);
        doc.line(x1, y1, (x0 + x1) / 2, y0);
        doc.setLineDashPattern([], 0);
      } else {
        for (let k = 0; k < s.shelves; k++) {
          const yy = y0 + ((y1 - y0) * (k + 1)) / (s.shelves + 1);
          doc.line(x0 + 0.5, yy, x1 - 0.5, yy);
        }
      }
      if (s.hangingRail && (front === 'open' || u.sliding.enabled)) {
        doc.setDrawColor(80);
        doc.setLineWidth(0.6);
        doc.line(x0 + 1, y1 + 3, x1 - 1, y1 + 3);
        doc.setLineWidth(0.25);
      }
      doc.setDrawColor(40);
    }
  }
  if (u.sliding.enabled) {
    doc.setDrawColor(...hexToRgb('#8a5a2b'));
    doc.setLineDashPattern([2, 1], 0);
    const p = u.sliding.panels;
    for (let k = 1; k < p; k++) doc.line(X((u.width * k) / p), Y(e.topY), X((u.width * k) / p), Y(e.baseH));
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(40);
  }
  // dimensions
  doc.setDrawColor(150);
  doc.setFontSize(7);
  doc.setTextColor(80);
  const dy = Y(0) + 4;
  doc.line(X(0), dy, X(u.width), dy);
  doc.line(X(0), dy - 1.2, X(0), dy + 1.2);
  doc.line(X(u.width), dy - 1.2, X(u.width), dy + 1.2);
  doc.text(`${u.width}`, (X(0) + X(u.width)) / 2, dy + 3.2, { align: 'center' });
  const dx = X(0) - 4;
  doc.line(dx, Y(0), dx, Y(u.height));
  doc.line(dx - 1.2, Y(0), dx + 1.2, Y(0));
  doc.line(dx - 1.2, Y(u.height), dx + 1.2, Y(u.height));
  doc.text(`${u.height}`, dx - 1.5, (Y(0) + Y(u.height)) / 2, { angle: 90, align: 'center' });
  doc.text(`D ${u.depth}`, X(u.width), Y(u.height) - 1.5, { align: 'right' });
  doc.setTextColor(0);
}

/* =============================================================== quote */

export function quotePdf(q: Quote, calc: QuoteCalc, s: Settings, cat: Catalog): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  const fm = (n: number) => money(n, s.pricing.currency);
  let y = drawHeader(doc, s, s.doc.quoteTitle, [
    ['Quote no.', q.number],
    ['Date', fmtDate(q.date)],
    ['Valid until', fmtDate(addDaysISO(q.date, s.doc.quoteValidityDays))],
  ]);
  y = partyBlock(doc, 'Prepared for', q.client, y, { label: 'Project', lines: [q.title, ...(q.notes ? [q.notes] : [])] });

  const body: RowInput[] = [];
  if (s.doc.quoteDetail === 'units') {
    calc.units.forEach((u, i) => {
      body.push([
        String(i + 1),
        { content: `${u.unit.name}\n${describeUnit(u.unit, cat).join('\n')}`, styles: { fontSize: 8 } },
        String(u.unit.qty),
        fm(u.sellEach),
        fm(u.sell),
      ]);
    });
  } else {
    const mk = 1 + q.markupPercent / 100;
    let i = 1;
    calc.units.forEach((u) => body.push([String(i++), { content: `${u.unit.name}\n${describeUnit(u.unit, cat).join('\n')}`, styles: { fontSize: 8 } }, String(u.unit.qty), '', '']));
    for (const l of calc.costLines) body.push([String(i++), `${l.group}: ${l.description}`, `${l.qty} ${l.unit}`, fm(l.unitPrice * mk), fm(l.total * mk)]);
    if (calc.labour) body.push([String(i++), 'Labour & manufacturing', '1', fm(calc.labour * mk), fm(calc.labour * mk)]);
    if (calc.installation) body.push([String(i++), 'Installation', '1', fm(calc.installation * mk), fm(calc.installation * mk)]);
  }
  const tr = s.pricing.transportOptions.find((t) => t.id === q.transportId);
  if (calc.transport) body.push([String(body.length + 1), tr ? `Transport – ${tr.name}` : 'Transport', '1', fm(calc.transport), fm(calc.transport)]);
  for (const e of q.extras) body.push([String(body.length + 1), e.description, String(e.qty), fm(e.unitPrice), fm(e.qty * e.unitPrice)]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Unit price', 'Amount']],
    body,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(s.doc.accentColor), fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 2, valign: 'top' },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
    margin: { left: M, right: M, top: 18, bottom: 24 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) drawMiniHeader(doc, s);
    },
  });
  y = lastY(doc, y) + 6;
  const rows: [string, string, boolean?][] = [['Subtotal', fm(calc.subtotal)]];
  if (calc.discount) rows.push([`Discount${q.discountType === 'percent' ? ` (${q.discountValue}%)` : ''}`, `-${fm(calc.discount)}`]);
  if (q.applyTax) rows.push([`${s.pricing.taxLabel} (${s.pricing.taxRate}%)`, fm(calc.tax)]);
  rows.push(['TOTAL', fm(calc.total), true]);
  y = totalsBlock(doc, rows, y, s);

  y = textSection(doc, 'Terms & conditions', s.doc.quoteTerms, y + 2, s);
  y = textSection(doc, 'Banking details', s.doc.bankDetails, y, s);
  y = signatures(doc, y, s, 'Client acceptance & date', `For ${s.company.name}`);

  // design pages
  if (s.doc.showRenders || s.doc.showElevations) {
    doc.addPage();
    y = drawMiniHeader(doc, s);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Design drawings', M, y + 2);
    y += 8;
    for (const u of calc.units) {
      const blockH = 82;
      y = ensureSpace(doc, y, blockH + 8, s);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${u.unit.name}${u.unit.qty > 1 ? ` × ${u.unit.qty}` : ''}`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(`${u.unit.width} × ${u.unit.height} × ${u.unit.depth} mm`, PAGE_W - M, y, { align: 'right' });
      doc.setTextColor(0);
      y += 3;
      const both = s.doc.showRenders && s.doc.showElevations;
      const colW = both ? (PAGE_W - 2 * M - 6) / 2 : PAGE_W - 2 * M;
      doc.setDrawColor(225);
      if (s.doc.showRenders) {
        const img = renderUnitImage(u.unit, u.build, cat, 900, 700, 'image/jpeg');
        doc.roundedRect(M, y, colW, blockH, 2, 2, 'S');
        if (img) {
          const ih = blockH - 4;
          const iw = Math.min(colW - 4, (ih * 900) / 700);
          doc.addImage(img, 'JPEG', M + (colW - iw) / 2, y + 2, iw, ih);
        }
      }
      if (s.doc.showElevations) {
        const ex = both ? M + colW + 6 : M;
        doc.roundedRect(ex, y, colW, blockH, 2, 2, 'S');
        drawElevation(doc, u.unit, cat, ex, y, colW, blockH);
      }
      y += blockH + 9;
    }
  }
  drawFooters(doc, s);
  return doc;
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

  for (const u of calc.units) {
    const rows: RowInput[] = u.build.parts.map((p) => [
      p.name,
      String(p.length),
      String(p.width),
      String(p.thickness),
      String(p.qty * u.unit.qty),
      p.kind === 'board' ? board(p.materialId)?.name ?? '' : p.kind === 'glass' ? cat.glass.find((g) => g.id === p.materialId)?.name ?? 'Glass' : cat.countertops.find((c) => c.id === p.materialId)?.name ?? '',
      p.edgeLength ? (p.edgeLength * p.qty * u.unit.qty).toFixed(2) : '',
    ]);
    autoTable(doc, {
      startY: y + 3,
      head: [[{ content: `${u.unit.name} × ${u.unit.qty}   (${u.unit.width}×${u.unit.height}×${u.unit.depth})`, colSpan: 7 }], ['Part', 'Length', 'Width', 'Thk', 'Qty', 'Material', 'Edge m']],
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
      return [a ? `${a.name} ${a.size}` : h.accessoryId, `${+(h.qty * u.unit.qty).toFixed(2)} ${a?.unit ?? ''}`, h.reason];
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
    body: inv.lines.map((l, i) => [String(i + 1), l.description, String(l.qty), fm(l.unitPrice), fm(l.qty * l.unitPrice)]),
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(s.doc.accentColor), fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
    margin: { left: M, right: M, top: 18, bottom: 24 },
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

export async function saveOrShare(doc: jsPDF, filename: string): Promise<void> {
  const safe = filename.replace(/[^\w.-]+/g, '_');
  if (Capacitor.isNativePlatform()) {
    const data = doc.output('datauristring').split(',')[1];
    const res = await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache });
    await Share.share({ title: safe, url: res.uri, dialogTitle: 'Share or save PDF' });
  } else {
    doc.save(safe);
  }
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
