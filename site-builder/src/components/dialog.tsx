import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';

// In-app replacements for window.confirm / window.prompt. Native dialogs are blocked in
// embedded viewers (and look out of place everywhere else).

interface Request {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (v: string | null) => void;
}

let enqueue: ((r: Request) => void) | null = null;

export function ask(o: { title: string; message?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!enqueue) return resolve(false);
    enqueue({ kind: 'confirm', ...o, resolve: (v) => resolve(v !== null) });
  });
}

export function askText(o: { title: string; message?: string; confirmLabel?: string; defaultValue?: string; placeholder?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    if (!enqueue) return resolve(null);
    enqueue({ kind: 'prompt', ...o, resolve });
  });
}

export function DialogHost() {
  const [req, setReq] = useState<Request>();
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    enqueue = (r) => {
      setValue(r.defaultValue ?? '');
      setReq(r);
    };
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (req?.kind === 'prompt') setTimeout(() => input.current?.select(), 0);
  }, [req]);

  if (!req) return null;
  const close = (result: string | null) => {
    req.resolve(result);
    setReq(undefined);
  };

  return (
    <Modal
      title={req.title}
      onClose={() => close(null)}
      footer={
        <>
          <button className="btn ghost" onClick={() => close(null)}>Cancel</button>
          <button className={`btn${req.danger ? ' btn-danger' : ''}`} onClick={() => close(req.kind === 'prompt' ? value : '')} disabled={req.kind === 'prompt' && !value.trim()}>
            {req.confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      {req.message && <p className="pre-wrap">{req.message}</p>}
      {req.kind === 'prompt' && (
        <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) close(value); }}>
          <input id="dialog-input" ref={input} value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} aria-label={req.title} />
        </form>
      )}
    </Modal>
  );
}
