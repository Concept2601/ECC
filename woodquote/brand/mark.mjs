// En-Quote brand master geometry (from the En-Quote Brand Guide v1.0, Nov 2026).
// The Folio mark: a finished quotation sheet with a folded corner, a slashed
// quotation mark (graphite + Think Different blue) and an orange full stop.
// Everything — app logo, icons, splash screens — is drawn from these paths.
export const COLORS = { graphite: '#1F2731', blue: '#004577', blueHi: '#5CA6E6', orange: '#E8732A', paper: '#F2F4F6', tileTop: '#2A333E', tileBottom: '#11161C', blueGradA: '#4A9EE4', blueGradB: '#0A5C9C' };

/** The mark on its 120-unit grid. `ink` = sheet + first stroke, `blue` = second stroke fill. */
export function markSvg({ ink = COLORS.paper, blue = 'url(#eqbl)', dot = COLORS.orange, stroke = 6 } = {}) {
  return `<g fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"><path d="M74 24H40a6 6 0 0 0-6 6v60a6 6 0 0 0 6 6h40a6 6 0 0 0 6-6V36Z"/><path d="M74 24V36H86Z" fill="${ink}"/></g><path d="M49 45h9l-8 28h-9Z" fill="${ink}"/><path d="M64 45h9l-8 28h-9Z" fill="${blue}"/><circle cx="75" cy="68.5" r="4.5" fill="${dot}"/>`;
}

export const DEFS = `<linearGradient id="eqbl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.blueGradA}"/><stop offset="1" stop-color="${COLORS.blueGradB}"/></linearGradient><linearGradient id="eqtile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.tileTop}"/><stop offset="1" stop-color="${COLORS.tileBottom}"/></linearGradient><linearGradient id="eqrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset=".35" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;

/** App icon: the mark on a graphite tile with a soft rim of light. `small` uses the heavier 7-unit stroke (below 32px). */
export function iconSvg({ rounded = true, small = false, size = 1024 } = {}) {
  const r = rounded ? 27 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}"><defs>${DEFS}</defs><rect width="120" height="120" rx="${r}" fill="url(#eqtile)"/>${rounded ? `<rect x=".5" y=".5" width="119" height="119" rx="26.5" fill="none" stroke="url(#eqrim)"/>` : ''}<g transform="translate(7.5 7.5) scale(.875)">${markSvg({ stroke: small ? 7 : 6 })}</g></svg>`;
}

/** Android adaptive foreground: mark only, inside the safe zone, transparent background. */
export function adaptiveForegroundSvg(size = 432, mono = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}"><defs>${DEFS}</defs><g transform="translate(19.5 19.5) scale(.675)">${mono ? markSvg({ ink: '#FFFFFF', blue: '#FFFFFF', dot: '#FFFFFF' }) : markSvg()}</g></svg>`;
}
