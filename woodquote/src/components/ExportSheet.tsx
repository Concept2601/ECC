import { Download, Loader2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { downloadPdf, sharePdf, usePdfExport } from '../pdf/pdf';
import { Modal } from './ui';

/** Shown whenever a quotation / invoice / receipt / cut list PDF is ready. */
export default function ExportSheet() {
  const { doc, filename, result } = usePdfExport();
  const [busy, setBusy] = useState('');
  const close = () => usePdfExport.setState({ doc: null, result: null });
  const run = async (kind: 'download' | 'share') => {
    if (!doc) return;
    setBusy(kind);
    try {
      if (kind === 'download') usePdfExport.setState({ result: await downloadPdf(doc, filename) });
      else await sharePdf(doc, filename);
    } catch (e) {
      usePdfExport.setState({ result: `Could not ${kind}: ${(e as Error).message}` });
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal open={!!doc} onClose={close} title="PDF ready">
      <p className="mb-3 truncate text-sm text-stone-600">📄 {filename}</p>
      <div className="grid gap-2">
        <button className="btn-primary" disabled={!!busy} onClick={() => run('download')}>
          {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download to phone
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => run('share')}>
          {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Share (WhatsApp, email…)
        </button>
      </div>
      {result && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{result}</p>}
    </Modal>
  );
}
