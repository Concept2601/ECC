const ALLOWED = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'span', 'div', 'hr', 'sub', 'sup', 'mark',
]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const SAFE_URL = /^(https?:|mailto:|tel:|#|\/|\.\.?\/)/i;

/**
 * Allow-list sanitiser for rich text produced by the editor.
 * Keeps formatting tags, drops every attribute except safe link attributes.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Allowed tags are emitted with sentinel brackets so any stray '<' or '>' left
  // over (e.g. an unterminated tag) can be escaped afterwards.
  const L = '\u0001';
  const R = '\u0002';
  const out = html
    .replace(/[\u0001\u0002]/g, '')
    .replace(DROP_WITH_CONTENT, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED.has(tag)) return '';
      if (full.startsWith('</')) return `${L}/${tag}${R}`;
      if (tag === 'a') {
        const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const url = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim();
        const safe = SAFE_URL.test(url) ? url.replace(/"/g, '&quot;') : '#';
        const external = /^https?:/i.test(url);
        return `${L}a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}${R}`;
      }
      return `${L}${tag}${R}`;
    });
  return out
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u0001/g, '<')
    .replace(/\u0002/g, '>');
}
