import { Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHistory } from '../app/history';
import { saveNow, useSaves } from '../app/savepoints';
import { actionKeys, keyLabel } from '../app/shortcuts';

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Undo, redo and save buttons shown in every page header. */
export default function EditTools({ light }: { light?: boolean }) {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { dirty, lastSavedAt, saving } = useSaves();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const tip = (label: string, id: Parameters<typeof actionKeys>[0]) => `${label} (${actionKeys(id).map(keyLabel).join(' / ')})`;
  const btn = `rounded-lg p-1.5 disabled:opacity-30 ${light ? 'text-white hover:bg-white/15' : 'text-stone-600 hover:bg-stone-100'}`;
  const status = saving ? 'Saving…' : dirty ? 'Unsaved changes' : lastSavedAt ? `Saved ${ago(lastSavedAt)}` : 'Not saved yet';
  return (
    <div className="flex items-center gap-0.5" data-edit-tools>
      <button className={btn} disabled={!canUndo} onClick={undo} title={tip('Undo', 'undo')} aria-label="Undo">
        <Undo2 size={18} />
      </button>
      <button className={btn} disabled={!canRedo} onClick={redo} title={tip('Redo', 'redo')} aria-label="Redo">
        <Redo2 size={18} />
      </button>
      <button className={`${btn} relative`} onClick={() => void saveNow('manual')} title={`${tip('Save', 'save')} · ${status}`} aria-label="Save">
        <Save size={18} />
        {dirty && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />}
      </button>
    </div>
  );
}
