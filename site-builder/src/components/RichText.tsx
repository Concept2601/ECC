import { useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { askText } from './dialog';

type Cmd = { cmd: string; arg?: string; label: string; title: string };

const TOOLS: (Cmd | '|')[] = [
  { cmd: 'formatBlock', arg: 'P', label: '¶', title: 'Paragraph' },
  { cmd: 'formatBlock', arg: 'H2', label: 'H2', title: 'Heading 2' },
  { cmd: 'formatBlock', arg: 'H3', label: 'H3', title: 'Heading 3' },
  '|',
  { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)' },
  { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)' },
  { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)' },
  { cmd: 'strikeThrough', label: 'S', title: 'Strikethrough' },
  '|',
  { cmd: 'insertUnorderedList', label: '•', title: 'Bulleted list' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
  { cmd: 'formatBlock', arg: 'BLOCKQUOTE', label: '❝', title: 'Quote' },
  '|',
  { cmd: 'createLink', label: '🔗', title: 'Add link' },
  { cmd: 'unlink', label: '⛓', title: 'Remove link' },
  { cmd: 'removeFormat', label: '⌫', title: 'Clear formatting' },
];

/** WYSIWYG editor that stores sanitised HTML. */
export function RichText({ value, onChange, label, minHeight = 120 }: { value: string; onChange: (html: string) => void; label: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');

  // Only push external changes into the DOM (keeps the caret stable while typing).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value && document.activeElement !== el) el.innerHTML = value;
  }, [value, mode]);

  const run = async (t: Cmd) => {
    ref.current?.focus();
    if (t.cmd === 'createLink') {
      // The dialog takes focus, so remember the selection and put it back afterwards.
      const sel = window.getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const url = await askText({ title: 'Add link', message: 'Paste a web address, a page like /contact, or mailto: / tel:.', defaultValue: 'https://', confirmLabel: 'Add link' });
      if (!url || !range) return;
      ref.current?.focus();
      sel!.removeAllRanges();
      sel!.addRange(range);
      document.execCommand('createLink', false, url.trim());
    } else document.execCommand(t.cmd, false, t.arg);
    emit();
  };

  const emit = () => ref.current && onChange(sanitizeHtml(ref.current.innerHTML));

  const words = value.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

  return (
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label={`${label} formatting`}>
        {mode === 'visual' &&
          TOOLS.map((t, i) =>
            t === '|' ? (
              <span key={i} className="sep" />
            ) : (
              <button key={i} type="button" title={t.title} aria-label={t.title} onMouseDown={(e) => e.preventDefault()} onClick={() => run(t)}>
                {t.label}
              </button>
            ),
          )}
        <span className="grow" />
        <button type="button" className="rte-mode" onClick={() => setMode(mode === 'visual' ? 'html' : 'visual')}>
          {mode === 'visual' ? '</> HTML' : 'Visual'}
        </button>
      </div>
      {mode === 'visual' ? (
        <div
          ref={ref}
          className="rte-area rich-preview"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          style={{ minHeight }}
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Paste as clean HTML (keeps structure, drops styles & scripts from Word/Docs/web).
            const html = e.clipboardData.getData('text/html');
            if (!html) return;
            e.preventDefault();
            document.execCommand('insertHTML', false, sanitizeHtml(html));
            emit();
          }}
        />
      ) : (
        <textarea className="rte-area mono" style={{ minHeight }} value={value} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(sanitizeHtml(e.target.value))} aria-label={`${label} HTML`} />
      )}
      <div className="rte-foot">{words} words</div>
    </div>
  );
}
