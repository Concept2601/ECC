/** Preview edition: built with VITE_DEMO=1 for embedded viewers that have no server, popups or downloads. */
export const DEMO = import.meta.env.VITE_DEMO === '1';

export const DEMO_NOTE = 'needs the installed studio — this preview edition has no server.';

/** Lets non-React helpers (downloads, deploys) surface a message through the studio's toasts. */
export const notify = (msg: string, kind: 'ok' | 'err' = 'err') =>
  window.dispatchEvent(new CustomEvent('tdv-notice', { detail: { msg, kind } }));
