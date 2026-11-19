import { describe, expect, it, vi } from 'vitest';
import { dataBin, K, listKeys, read } from '../../app/db';
import { flushSave, loadData, useStore } from '../../store';

describe('split database', () => {
  it('saves each quotation in its own record and loads it back', async () => {
    await loadData(); // empty device: starts fresh and writes the bins
    const st = useStore.getState();
    expect(st.hydrated).toBe(true);
    const a = st.createQuote({ title: 'Kitchen A' });
    const b = st.createQuote({ title: 'Kitchen B' });
    await flushSave();
    expect((await listKeys(dataBin)).filter((k) => k.startsWith('quote:'))).toHaveLength(2);

    // editing one quotation rewrites only that record
    const spy = vi.spyOn(dataBin.mem, 'set');
    useStore.getState().updateQuote(a, (q) => (q.title = 'Kitchen A – revised'));
    await flushSave();
    expect(spy.mock.calls.map((c) => c[0])).toEqual([K.quote(a)]);
    spy.mockRestore();

    useStore.getState().deleteQuote(b);
    await flushSave();
    expect(await read(dataBin, K.quote(b))).toBeUndefined();

    // a fresh start reads the bins back
    useStore.setState({ quotes: [], hydrated: false });
    await loadData();
    const qs = useStore.getState().quotes;
    expect(qs.map((q) => q.title)).toEqual(['Kitchen A – revised']);
    expect(useStore.getState().counters.quote).toBe(2);
  });
});
