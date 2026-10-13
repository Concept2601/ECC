// Helpers for compartments that can be split on their own (side by side or
// stacked) without affecting the rest of the unit.
import { elevation } from './generate';
import { sec } from './presets';
import type { Catalog, Section, SectionRef, Unit } from './types';
import { sum } from './util';

export const sameRef = (a: SectionRef | null | undefined, b: SectionRef | null | undefined) =>
  !!a && !!b && a.bay === b.bay && a.section === b.section && (a.path ?? []).join('.') === (b.path ?? []).join('.');

/** The compartment (or split container) a ref points at. */
export function getSection(u: Unit, ref: SectionRef): Section | null {
  let s: Section | undefined = u.bays[ref.bay]?.sections[ref.section];
  for (const i of ref.path ?? []) s = s?.split?.parts[i];
  return s ?? null;
}

export const parentRef = (ref: SectionRef): SectionRef | null => (ref.path?.length ? { ...ref, path: ref.path.slice(0, -1) } : null);

/** Every leaf compartment of a unit (what actually gets a front). */
export function leafSections(u: Unit): Section[] {
  const out: Section[] = [];
  const walk = (s: Section) => (s.split && s.split.parts.length > 1 ? s.split.parts.forEach(walk) : out.push(s));
  u.bays.forEach((b) => b.sections.forEach(walk));
  return out;
}

export interface CellRect {
  ref: SectionRef;
  sec: Section;
  x: number;
  y: number;
  w: number;
  h: number;
  leaf: boolean;
  parentDir: 'cols' | 'rows' | null; // how this cell sits inside its parent split
}

/** Rectangles (front view, unit coordinates) of every compartment and split container. */
export function cellRects(u: Unit, cat: Catalog): CellRect[] {
  const e = elevation(u, cat);
  const t = e.t;
  const out: CellRect[] = [];
  const walk = (s: Section, ref: SectionRef, x: number, y: number, w: number, h: number, parentDir: CellRect['parentDir']) => {
    const parts = s.split?.parts ?? [];
    const leaf = !(s.split && parts.length > 1);
    out.push({ ref, sec: s, x, y, w, h, leaf, parentDir });
    if (leaf) return;
    const total = sum(parts.map((p) => p.size)) || 1;
    const k = parts.length;
    let pos = s.split!.dir === 'cols' ? x : y;
    parts.forEach((p, i) => {
      const r = { ...ref, path: [...(ref.path ?? []), i] };
      if (s.split!.dir === 'cols') {
        const pw = ((w - (k - 1) * t) * p.size) / total;
        walk(p, r, pos, y, pw, h, 'cols');
        pos += pw + t;
      } else {
        const ph = ((h - (k - 1) * t) * p.size) / total;
        walk(p, r, x, pos, w, ph, 'rows');
        pos += ph + t;
      }
    });
  };
  e.bays.forEach((b) => b.sections.forEach((s) => walk(u.bays[b.index].sections[s.index], { bay: b.index, section: s.index }, b.x, s.y, b.w, s.h, null)));
  return out;
}

/** Split only the selected compartment into two. Returns the ref of the new second half. */
export function splitSection(u: Unit, ref: SectionRef, dir: 'cols' | 'rows'): SectionRef | null {
  const target = getSection(u, ref);
  if (!target) return null;
  const pref = parentRef(ref);
  const parent = pref ? getSection(u, pref) : null;
  const copy = (src: Section) => sec({ front: src.front === 'appliance' ? 'door' : src.front, doorMaterial: src.doorMaterial, fit: src.fit, opening: src.opening, slide: src.slide, drawerCount: src.drawerCount });
  // same direction as the parent split: add a sibling instead of nesting
  if (parent?.split && parent.split.dir === dir) {
    const idx = ref.path![ref.path!.length - 1];
    const half = target.size / 2;
    target.size = half;
    parent.split.parts.splice(idx + 1, 0, { ...copy(target), size: half });
    return { ...ref, path: [...ref.path!.slice(0, -1), idx + 1] };
  }
  // top-level rows: keep the classic behaviour (a fixed shelf across the bay)
  if (!pref && dir === 'rows' && !target.split) {
    const b = u.bays[ref.bay];
    const half = target.size / 2;
    target.size = half;
    b.sections.splice(ref.section + 1, 0, { ...copy(target), size: half });
    return { bay: ref.bay, section: ref.section + 1 };
  }
  const { split: _old, ...leafFields } = target;
  void _old;
  const first: Section = { ...(leafFields as Section), id: `${target.id}a`, size: 1, split: null };
  target.split = { dir, parts: [first, { ...copy(target), size: 1 }] };
  return { ...ref, path: [...(ref.path ?? []), 1] };
}

/** Remove a compartment from its split (its space goes to the neighbour). */
export function mergeSection(u: Unit, ref: SectionRef): SectionRef | null {
  const pref = parentRef(ref);
  if (!pref) {
    const b = u.bays[ref.bay];
    if (b.sections.length < 2) return null;
    const removed = b.sections.splice(ref.section, 1)[0];
    const n = Math.min(ref.section, b.sections.length - 1);
    b.sections[n].size += removed.size;
    return { bay: ref.bay, section: n };
  }
  const parent = getSection(u, pref)!;
  const parts = parent.split!.parts;
  const idx = ref.path![ref.path!.length - 1];
  const removed = parts.splice(idx, 1)[0];
  const n = Math.min(idx, parts.length - 1);
  parts[n].size += removed.size;
  if (parts.length === 1) {
    // collapse the split: the remaining child takes the parent's place
    const only = parts[0];
    const size = parent.size;
    const id = parent.id;
    Object.assign(parent, only, { id, size });
    if (!only.split) parent.split = null;
    return pref;
  }
  return { ...pref, path: [...pref.path!, n] };
}
