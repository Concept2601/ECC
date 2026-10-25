// Settings › Developer information: who made En-Quote, the licence, version
// history, usage and privacy policies, documentation and hardware specs.
import { BookOpen, ChevronDown, Cpu, FileText, Heart, History, Keyboard, Loader2, Shield, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CHANGELOG } from '../app/changelog';
import { DEVELOPER } from '../app/developer';
import { activate, LICENSE_DAYS, licenceState, type LicenceState } from '../app/license';
import { runAction } from '../app/shortcuts';
import { LicenceManager, useLicence } from './Licence';
import { Card } from './ui';

function Fold({ title, icon, children, open = false }: { title: string; icon: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="card group" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-bold uppercase tracking-wide text-stone-600">
        {icon} {title}
        <ChevronDown size={16} className="ml-auto transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-stone-100 p-4 text-sm leading-relaxed text-stone-700">{children}</div>
    </details>
  );
}

export const HARDWARE: { device: string; min: string[]; rec: string[] }[] = [
  {
    device: 'Windows PC (64-bit app)',
    min: ['Windows 10 64-bit', 'Dual-core 2 GHz processor', '4 GB RAM', 'Graphics with DirectX 11 / WebGL 2 (integrated is fine)', '500 MB free disk', '1366 × 768 screen'],
    rec: ['Windows 11 64-bit', '4+ core processor (Intel i5 / Ryzen 5 or better)', '8–16 GB RAM', 'Dedicated graphics, 2 GB+ video memory (for High / Maximum render quality)', 'SSD', '1920 × 1080 screen or larger'],
  },
  {
    device: 'Android phone / tablet',
    min: ['Android 7.0 (Nougat) or newer', '3 GB RAM', 'OpenGL ES 3.0 graphics', '200 MB free storage', 'Render quality: Phone / battery saver'],
    rec: ['Android 11 or newer', '6–8 GB RAM', 'Mid-range or better chip (Snapdragon 7-series, Dimensity 700+, Helio G90+)', '1 GB free storage for quotes and PDFs', 'Render quality: Balanced (8 GB RAM)'],
  },
  {
    device: 'iPhone / iPad',
    min: ['iOS / iPadOS 15', 'iPhone 8 / iPhone XR or newer (A11 chip)', '3 GB RAM', '200 MB free storage'],
    rec: ['iOS 17 or newer', 'iPhone 12 or newer (A14+), iPad Air / Pro', '4–6 GB RAM', '1 GB free storage'],
  },
  {
    device: 'Web browser',
    min: ['Chrome / Edge 110+, Safari 16+, Firefox 115+', 'WebGL 2 enabled', '4 GB RAM'],
    rec: ['Latest Chrome or Edge', '8 GB RAM', 'Hardware acceleration switched on'],
  },
];

export const COMMON_REQUIREMENTS = [
  'Internet: only for the AI diagram / plan readers (everything else, including the licence check, works offline)',
  'Camera (optional): for photographing plans and sketches',
  'Printer (optional): PDFs print from any PDF viewer',
];

export default function DeveloperInfo() {
  const lic = useLicence();
  const [state, setState] = useState<LicenceState | null>(null);
  const cur = state ?? lic;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-4">
          <img src="./favicon.svg" className="h-16 w-16" />
          <div>
            <div className="text-lg font-bold">{DEVELOPER.product}</div>
            <div className="text-sm text-stone-600">
              Version {DEVELOPER.version} · Developer <b>{DEVELOPER.name}</b>, {DEVELOPER.country}
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm italic text-brand-700">
              <Heart size={14} className="fill-current" /> {DEVELOPER.tagline}
            </div>
          </div>
        </div>
      </Card>

      <Fold title="Licence" icon={<ShieldCheck size={16} />} open>
        {cur?.ok ? (
          <p>
            Licensed to <b>{cur.licence.email}</b> until <b>{new Date(cur.licence.expiresAt).toLocaleDateString()}</b> ({cur.daysLeft} day{cur.daysLeft === 1 ? '' : 's'} left).
          </p>
        ) : (
          <p>Checking…</p>
        )}
        <p className="mt-1 text-xs text-stone-500">Each code from the developer adds {LICENSE_DAYS} days. Renewing before the end keeps the days you have left.</p>
        <form
          className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg('');
            try {
              const l = await activate(email || (cur?.licence?.email ?? ''), code);
              setState(await licenceState());
              setMsg(`Renewed until ${new Date(l.expiresAt).toLocaleDateString()}.`);
              setCode('');
            } catch (x) {
              setMsg((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input" type="email" placeholder={cur?.licence?.email ?? 'Email'} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input text-center font-mono tracking-widest" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn-primary" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Renew
          </button>
        </form>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
        <div className="mt-4 rounded-xl border border-stone-200 p-3">
          <div className="mb-2 font-semibold">Developer: issue licence codes</div>
          <LicenceManager />
        </div>
      </Fold>

      <Fold title="Version history" icon={<History size={16} />}>
        <div className="space-y-4">
          {CHANGELOG.map((r) => (
            <div key={r.version}>
              <div className="font-bold">
                {r.version} — {r.title} <span className="text-xs font-normal text-stone-500">{r.date}</span>
              </div>
              {(
                [
                  ['Added', r.added],
                  ['Updated', r.updated],
                  ['Upgraded', r.upgraded],
                  ['Fixed', r.fixed],
                ] as const
              ).map(([label, list]) =>
                list?.length ? (
                  <div key={label} className="mt-1">
                    <span className="label">{label}</span>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {list.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      </Fold>

      <Fold title="Hardware specifications" icon={<Cpu size={16} />}>
        <div className="grid gap-3 md:grid-cols-2">
          {HARDWARE.map((h) => (
            <div key={h.device} className="rounded-xl border border-stone-200 p-3">
              <div className="mb-1 font-bold">{h.device}</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="label">Minimum</span>
                  <ul className="list-disc space-y-0.5 pl-4">{h.min.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <span className="label">Recommended</span>
                  <ul className="list-disc space-y-0.5 pl-4">{h.rec.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-stone-600">{COMMON_REQUIREMENTS.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 text-xs text-stone-500">See Settings › Customization › Performance for this device’s processor, memory and graphics card, and to choose the render quality.</p>
      </Fold>

      <Fold title="Documentation" icon={<BookOpen size={16} />}>
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Set up</b> your business details, logo and document header / footer in Settings › Customization, and your material prices in Settings › Material pricing hub.</li>
          <li><b>Quote</b>: Dashboard › + (or Ctrl+N). Fill in Client details, then in Design add units (TV stands, wardrobes, islands…) or a whole kitchen. Tap the 3D render or a cabinet to design it: bays, compartments, doors, drawers, appliances, lighting, finishes.</li>
          <li><b>Quick quotes on site</b>: Measure a space (Ctrl+M) — enter the width, height and depth to see what fits and price it in one tap.</li>
          <li><b>From drawings</b>: the Diagram reader turns a sketch, plan or 3D image into units; the Plan reader turns a floor plan PDF into a room with BICs, kitchen and island positions. Use an Anthropic / OpenAI key, or your ChatGPT by copy-and-paste.</li>
          <li><b>Check materials</b>: Material hub changes materials for the whole job; Material schedule shows the cutting plans, joined parts, used and wasted board.</li>
          <li><b>Send</b>: Reporting › Quotation PDF (Ctrl+P). Add room layouts and render views for the client.</li>
          <li><b>Invoice</b>: Invoices › New invoice › pick the quotation. Add deviations (extras / credits) and record deposits and payments to issue receipts.</li>
          <li><b>Keep it safe</b>: Save (Ctrl+S) and auto-save keep restorable versions; export a backup file from Settings › Software backup. Backups from older versions restore too.</li>
        </ol>
        <button className="btn-secondary mt-3" onClick={() => runAction('help')}>
          <Keyboard size={16} /> Keyboard shortcuts (F1)
        </button>
      </Fold>

      <Fold title="Usage policy" icon={<FileText size={16} />}>
        <ul className="list-disc space-y-1 pl-5">
          <li>En-Quote is licensed, not sold. Each licence is for the email address it was issued to and is valid for {LICENSE_DAYS} days per code; it renews with a new code from the developer.</li>
          <li>Do not share, resell, copy, decompile or modify the software, or try to get round the licence check.</li>
          <li>Quotations, cutting lists and measurements are worked out from the information you enter. Check sizes on site and review every quotation before sending it — the developer is not responsible for losses from incorrect inputs, prices or measurements.</li>
          <li>AI readers can misread drawings; always check what they produce.</li>
          <li>The software is provided as it is. Features may change between versions; your data is kept and upgraded.</li>
        </ul>
      </Fold>

      <Fold title="Privacy policy" icon={<Shield size={16} />}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your quotations, invoices, clients, prices and settings are stored only on this device. Nothing is sent to the developer.</li>
          <li>The licence check runs on the device; only your licence email is stored with it.</li>
          <li>When you press “Read” in the diagram or plan reader, the image or PDF you chose is sent to the AI service you selected (Anthropic or OpenAI) using your own API key, under that company’s privacy terms. In “With my ChatGPT” mode you send it yourself.</li>
          <li>The camera is used only when you choose to take a photo. There are no ads, trackers or analytics.</li>
          <li>Backups and PDFs are files you control. Deleting the app deletes its data — keep a backup.</li>
        </ul>
      </Fold>
    </div>
  );
}
