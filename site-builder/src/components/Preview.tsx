import { useEffect, useMemo, useRef, useState } from 'react';
import type { Page, Site } from '../types';
import { renderPage } from '../lib/render';

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

/** Live, sandboxed preview of a page. Clicks on sections select them in the editor. */
export function Preview({ site, page, device, selectedId, onSelect, onNavigate }: {
  site: Site;
  page: Page;
  device: Device;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNavigate?: (pageId: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const [scale, setScale] = useState(1);
  const [doc, setDoc] = useState('');

  const html = useMemo(() => renderPage(site, page, { mode: 'preview', selectedBlockId: selectedId }), [site, page, selectedId]);

  // Debounce so typing doesn't reload the frame on every key.
  useEffect(() => {
    const t = setTimeout(() => {
      scroll.current = frame.current?.contentWindow?.scrollY ?? 0;
      setDoc(html);
    }, 180);
    return () => clearTimeout(t);
  }, [html]);

  // Reset scroll on page change.
  useEffect(() => {
    scroll.current = 0;
  }, [page.id]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'sb:select') onSelect?.(e.data.blockId);
      if (e.data?.type === 'sb:navigate') onNavigate?.(e.data.pageId);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onSelect, onNavigate]);

  const width = DEVICE_WIDTH[device];
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 32) / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div className="preview-box" ref={box}>
      <div className={`device device-${device}`} style={{ width, transform: `scale(${scale})`, height: `calc((100% - 8px) / ${scale})` }}>
        <iframe
          ref={frame}
          title={`Preview of ${page.name}`}
          srcDoc={doc}
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => frame.current?.contentWindow?.scrollTo(0, scroll.current)}
        />
      </div>
    </div>
  );
}

export function scrollPreviewTo(blockId: string) {
  document.querySelectorAll<HTMLIFrameElement>('.preview-box iframe').forEach((f) => f.contentWindow?.postMessage({ type: 'sb:scroll', blockId }, '*'));
}
