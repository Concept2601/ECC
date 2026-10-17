import { Building2, ChevronRight, DatabaseBackup, Download, Eye, Info, Layers, Palette, Plus, ScanLine, Trash2, Upload } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Library from './Library';
import DeveloperInfo from '../components/DeveloperInfo';
import { useRef, useState } from 'react';
import { Card, confirmAction, Field, NumInput, PageHeader, Select, Tabs, TextInput, Toggle } from '../components/ui';
import { createUnit } from '../lib/presets';
import { calculateQuote } from '../lib/pricing';
import type { Quote } from '../lib/types';
import { todayISO } from '../lib/util';
import { quotePdf, saveOrShare, shareTextFile } from '../pdf/pdf';
import { exportData, isWoodQuoteData, normalizeData, useStore } from '../store';
import { PerformanceCard, SavingCard, ShortcutsCard } from '../components/SettingsExtras';

type Tab = 'company' | 'documents' | 'keys' | 'performance' | 'library' | 'pricing' | 'ai' | 'saving' | 'backup' | 'developer';

const SECTIONS: { id: string; title: string; text: string; icon: typeof Building2; tabs: { value: Tab; label: string }[] }[] = [
  { id: 'customization', title: 'Customization', text: 'Business details, document header & footer, keyboard shortcuts, performance', icon: Palette, tabs: [{ value: 'company', label: 'Business' }, { value: 'documents', label: 'Documents' }, { value: 'keys', label: 'Keyboard' }, { value: 'performance', label: 'Performance' }] },
  { id: 'materials', title: 'Material pricing hub', text: 'Boards, edging, glass, worktops, hardware, appliances, pricing & cutting', icon: Layers, tabs: [{ value: 'library', label: 'Material prices' }, { value: 'pricing', label: 'Pricing & cutting' }] },
  { id: 'ai', title: 'Diagram (AI) reader', text: 'Keys and models for the diagram and plan readers', icon: ScanLine, tabs: [{ value: 'ai', label: 'AI reader configuration' }] },
  { id: 'backup', title: 'Software backup', text: 'Save points, auto-save, undo history, backup & restore', icon: DatabaseBackup, tabs: [{ value: 'saving', label: 'Saving & versions' }, { value: 'backup', label: 'Backup & restore' }] },
  { id: 'developer', title: 'Developer information', text: 'Developer, licence, version history, policies, documentation, hardware specs', icon: Info, tabs: [{ value: 'developer', label: 'About' }] },
];

async function fileToDataUrl(file: File, maxSide = 1600, type = 'image/png', quality = 0.9): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const sc = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc);
    c.height = Math.round(img.height * sc);
    const g = c.getContext('2d')!;
    if (type === 'image/jpeg') {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
    }
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(type, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SettingsPage() {
  const { settings, updateSettings, catalog, importData } = useStore();
  const { section = '' } = useParams();
  const sec = SECTIONS.find((x) => x.id === section);
  const [tabState, setTab] = useState<Tab>('company');
  const tab: Tab = sec ? (sec.tabs.some((t) => t.value === tabState) ? tabState : sec.tabs[0].value) : tabState;
  const logoRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const c = settings.company;
  const d = settings.doc;
  const p = settings.pricing;

  const preview = () => {
    const q: Quote = {
      id: 'preview',
      number: `${d.quotePrefix}0000`,
      title: 'Sample living room TV unit',
      date: todayISO(),
      status: 'draft',
      client: { name: 'Sample Client', phone: '+263 77 123 4567', email: 'client@example.com', address: '45 Sample Avenue\nHarare' },
      units: [createUnit('tv_stand')],
      runs: [],
      attachments: [],
      includeAppliances: true,
      room: null,
      extras: [],
      transportId: p.transportOptions[0]?.id ?? null,
      transportCustom: 0,
      installation: true,
      markupPercent: p.markupPercent,
      discountType: 'percent',
      discountValue: 5,
      applyTax: p.taxRate > 0,
      notes: '',
      sourceImage: null,
      createdAt: 0,
      updatedAt: 0,
    };
    saveOrShare(quotePdf(q, calculateQuote(q, catalog, settings), settings, catalog), 'template-preview.pdf');
  };

  return (
    <div>
      <PageHeader title={sec?.title ?? 'Settings'} back={sec ? '/settings' : undefined} />
      <div className="mx-auto max-w-5xl space-y-3 p-3">
        {!sec && (
          <div className="grid gap-3 md:grid-cols-2">
            {SECTIONS.map((x) => (
              <Link key={x.id} to={`/settings/${x.id}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
                <span className="rounded-xl bg-brand-100 p-3 text-brand-700">
                  <x.icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{x.title}</span>
                  <span className="block text-xs text-stone-500">{x.text}</span>
                </span>
                <ChevronRight size={18} className="text-stone-400" />
              </Link>
            ))}
          </div>
        )}
        {sec && sec.tabs.length > 1 && <Tabs<Tab> value={tab} onChange={setTab} tabs={sec.tabs} />}
      </div>
      {sec && (
      <div className="mx-auto max-w-5xl space-y-3 p-3 pt-0">
        {tab === 'company' && (
          <Card title="Business details (document header)">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                  {c.logo ? <img src={c.logo} className="h-full w-full object-contain" /> : <span className="text-xs text-stone-400">No logo</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <button className="btn-secondary px-3 py-1.5" onClick={() => logoRef.current?.click()}>
                    <Upload size={14} /> Upload logo
                  </button>
                  {c.logo && (
                    <button className="btn-ghost px-3 py-1.5 text-red-600" onClick={() => updateSettings((s) => (s.company.logo = null))}>
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const url = await fileToDataUrl(f, 600);
                      updateSettings((s) => (s.company.logo = url));
                    }
                    e.target.value = '';
                  }}
                />
              </div>
              <Field label="Business name">
                <TextInput value={c.name} onChange={(v) => updateSettings((s) => (s.company.name = v))} />
              </Field>
              <Field label="Tagline">
                <TextInput value={c.tagline} onChange={(v) => updateSettings((s) => (s.company.tagline = v))} />
              </Field>
              <Field label="Address">
                <TextInput multiline value={c.address} onChange={(v) => updateSettings((s) => (s.company.address = v))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <TextInput value={c.phone} onChange={(v) => updateSettings((s) => (s.company.phone = v))} />
                </Field>
                <Field label="Email">
                  <TextInput value={c.email} onChange={(v) => updateSettings((s) => (s.company.email = v))} />
                </Field>
                <Field label="Website">
                  <TextInput value={c.website} onChange={(v) => updateSettings((s) => (s.company.website = v))} />
                </Field>
                <Field label="Tax / VAT / BP number">
                  <TextInput value={c.taxNumber} onChange={(v) => updateSettings((s) => (s.company.taxNumber = v))} />
                </Field>
              </div>
            </div>
          </Card>
        )}

        {tab === 'documents' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Header" actions={<button className="btn-secondary px-3 py-1.5" onClick={preview}><Eye size={14} /> Preview</button>}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Accent colour">
                    <input type="color" className="h-10 w-full rounded-xl border border-stone-300" value={d.accentColor} onChange={(e) => updateSettings((s) => (s.doc.accentColor = e.target.value))} />
                  </Field>
                  <Field label="Logo position">
                    <Select value={d.logoPosition} onChange={(v) => v && updateSettings((s) => (s.doc.logoPosition = v))} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }]} />
                  </Field>
                </div>
                <Field label="Extra header text (slogan, registration, etc.)">
                  <TextInput multiline value={d.headerText} onChange={(v) => updateSettings((s) => (s.doc.headerText = v))} />
                </Field>
                <div>
                  <span className="label">Custom header fields</span>
                  <div className="space-y-2">
                    {d.headerFields.map((f, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                        <input className="input" placeholder="Label" value={f.label} onChange={(e) => updateSettings((s) => (s.doc.headerFields[i].label = e.target.value))} />
                        <input className="input" placeholder="Value" value={f.value} onChange={(e) => updateSettings((s) => (s.doc.headerFields[i].value = e.target.value))} />
                        <button className="btn-ghost px-2 text-red-600" onClick={() => updateSettings((s) => s.doc.headerFields.splice(i, 1))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary px-3 py-1.5" onClick={() => updateSettings((s) => s.doc.headerFields.push({ label: '', value: '' }))}>
                      <Plus size={14} /> Add field
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Quote title">
                    <TextInput value={d.quoteTitle} onChange={(v) => updateSettings((s) => (s.doc.quoteTitle = v))} />
                  </Field>
                  <Field label="Invoice title">
                    <TextInput value={d.invoiceTitle} onChange={(v) => updateSettings((s) => (s.doc.invoiceTitle = v))} />
                  </Field>
                  <Field label="Receipt title">
                    <TextInput value={d.receiptTitle} onChange={(v) => updateSettings((s) => (s.doc.receiptTitle = v))} />
                  </Field>
                  <Field label="Quote prefix">
                    <TextInput value={d.quotePrefix} onChange={(v) => updateSettings((s) => (s.doc.quotePrefix = v))} />
                  </Field>
                  <Field label="Invoice prefix">
                    <TextInput value={d.invoicePrefix} onChange={(v) => updateSettings((s) => (s.doc.invoicePrefix = v))} />
                  </Field>
                  <Field label="Receipt prefix">
                    <TextInput value={d.receiptPrefix} onChange={(v) => updateSettings((s) => (s.doc.receiptPrefix = v))} />
                  </Field>
                </div>
              </div>
            </Card>
            <Card title="Footer & content">
              <div className="space-y-3">
                <Field label="Footer text (every page)">
                  <TextInput multiline value={d.footerText} onChange={(v) => updateSettings((s) => (s.doc.footerText = v))} />
                </Field>
                <Toggle label="Page numbers" checked={d.showPageNumbers} onChange={(v) => updateSettings((s) => (s.doc.showPageNumbers = v))} />
                <Field label="Banking / payment details">
                  <TextInput multiline value={d.bankDetails} placeholder="Bank, account name, account no., branch, mobile money…" onChange={(v) => updateSettings((s) => (s.doc.bankDetails = v))} />
                </Field>
                <Field label="Quotation terms">
                  <TextInput multiline rows={5} value={d.quoteTerms} onChange={(v) => updateSettings((s) => (s.doc.quoteTerms = v))} />
                </Field>
                <Field label="Invoice terms">
                  <TextInput multiline value={d.invoiceTerms} onChange={(v) => updateSettings((s) => (s.doc.invoiceTerms = v))} />
                </Field>
                <Field label="Receipt note">
                  <TextInput value={d.receiptNote} onChange={(v) => updateSettings((s) => (s.doc.receiptNote = v))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quote valid for">
                    <NumInput value={d.quoteValidityDays} min={1} suffix="days" onChange={(v) => updateSettings((s) => (s.doc.quoteValidityDays = v))} />
                  </Field>
                  <Field label="Quotation detail">
                    <Select value={d.quoteDetail} onChange={(v) => v && updateSettings((s) => (s.doc.quoteDetail = v))} options={[{ value: 'units', label: 'Price per unit' }, { value: 'itemised', label: 'Itemised materials' }]} />
                  </Field>
                </div>
                <Toggle label="Include 3D renders" checked={d.showRenders} onChange={(v) => updateSettings((s) => (s.doc.showRenders = v))} />
                <Toggle label="Include dimensioned drawings" checked={d.showElevations} onChange={(v) => updateSettings((s) => (s.doc.showElevations = v))} />
                <Toggle label="Signature lines" checked={d.signatureLine} onChange={(v) => updateSettings((s) => (s.doc.signatureLine = v))} />
              </div>
            </Card>
          </div>
        )}

        {tab === 'pricing' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Money">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Currency symbol">
                  <TextInput value={p.currency} onChange={(v) => updateSettings((s) => (s.pricing.currency = v))} />
                </Field>
                <Field label="Default markup">
                  <NumInput value={p.markupPercent} suffix="%" onChange={(v) => updateSettings((s) => (s.pricing.markupPercent = v))} />
                </Field>
                <Field label="Tax label">
                  <TextInput value={p.taxLabel} onChange={(v) => updateSettings((s) => (s.pricing.taxLabel = v))} />
                </Field>
                <Field label="Tax rate">
                  <NumInput value={p.taxRate} suffix="%" min={0} onChange={(v) => updateSettings((s) => (s.pricing.taxRate = v))} />
                </Field>
                <Field label="Labour charged as">
                  <Select value={p.labourMode} onChange={(v) => v && updateSettings((s) => (s.pricing.labourMode = v))} options={[{ value: 'percent', label: '% of materials' }, { value: 'perUnit', label: 'Fixed per unit' }]} />
                </Field>
                {p.labourMode === 'percent' ? (
                  <Field label="Labour %">
                    <NumInput value={p.labourPercent} suffix="%" onChange={(v) => updateSettings((s) => (s.pricing.labourPercent = v))} />
                  </Field>
                ) : (
                  <Field label="Labour per unit">
                    <NumInput value={p.labourPerUnit} onChange={(v) => updateSettings((s) => (s.pricing.labourPerUnit = v))} />
                  </Field>
                )}
                <Field label="Installation">
                  <NumInput value={p.installationPercent} suffix="% mat." onChange={(v) => updateSettings((s) => (s.pricing.installationPercent = v))} />
                </Field>
                <Field label="Edging waste allowance">
                  <NumInput value={p.edgingWastePercent} suffix="%" onChange={(v) => updateSettings((s) => (s.pricing.edgingWastePercent = v))} />
                </Field>
              </div>
            </Card>
            <Card title="Cutting optimiser">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cutting method" className="col-span-2">
                  <Select value={p.cutMode} onChange={(v) => v && updateSettings((s) => (s.pricing.cutMode = v))} options={[{ value: 'guillotine', label: 'Guillotine – panel saw / table saw' }, { value: 'nested', label: 'Nested – CNC router (tighter)' }]} />
                </Field>
                <Field label="Board charging" className="col-span-2">
                  <Select value={p.boardCharging} onChange={(v) => v && updateSettings((s) => (s.pricing.boardCharging = v))} options={[{ value: 'fullSheets', label: 'Charge full sheets (waste included)' }, { value: 'usedArea', label: 'Full sheets minus reusable offcuts' }]} />
                </Field>
                <Field label="Saw kerf">
                  <NumInput value={p.kerf} suffix="mm" min={0} onChange={(v) => updateSettings((s) => (s.pricing.kerf = v))} />
                </Field>
                <Field label="Edge trim per side">
                  <NumInput value={p.sheetTrim} suffix="mm" min={0} onChange={(v) => updateSettings((s) => (s.pricing.sheetTrim = v))} />
                </Field>
                <Field label="Smallest reusable offcut">
                  <NumInput value={p.minOffcut} suffix="mm" min={0} onChange={(v) => updateSettings((s) => (s.pricing.minOffcut = v))} />
                </Field>
                <Field label="Screws per joint">
                  <NumInput value={p.screwsPerJoint} min={0} onChange={(v) => updateSettings((s) => (s.pricing.screwsPerJoint = v))} />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {tab === 'ai' && (
          <Card title="Diagram reader">
            <div className="space-y-3 text-sm">
              <p className="text-stone-600">
                The diagram reader and plan reader use Claude to read plans, sketches, photos and 3D renders, then builds units with dimensions automatically. Add your Anthropic API key from{' '}
                <a className="font-semibold text-brand-700" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                  console.anthropic.com
                </a>
                . The key is stored only on this device.
              </p>
              <Field label="Anthropic API key">
                <input className="input font-mono" type="password" autoComplete="off" placeholder="sk-ant-…" value={settings.ai.apiKey} onChange={(e) => updateSettings((s) => (s.ai.apiKey = e.target.value.trim()))} />
              </Field>
              <Field label="Model">
                <TextInput value={settings.ai.model} onChange={(v) => updateSettings((s) => (s.ai.model = v.trim()))} />
              </Field>
              <hr className="border-stone-200" />
              <p className="font-semibold">Plan reader</p>
              <p className="text-stone-600">
                The plan reader can use the Anthropic key above or an OpenAI API key from{' '}
                <a className="font-semibold text-brand-700" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  platform.openai.com
                </a>
                . A ChatGPT Plus / Pro subscription does not include API access — to use your subscription, choose “With my ChatGPT” in the plan reader and paste the answer back.
              </p>
              <Field label="Plan reader uses">
                <select className="input" value={settings.ai.provider ?? 'anthropic'} onChange={(e) => updateSettings((s) => (s.ai.provider = e.target.value as 'anthropic' | 'openai'))}>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
              <Field label="OpenAI API key">
                <input className="input font-mono" type="password" autoComplete="off" placeholder="sk-…" value={settings.ai.openaiKey ?? ''} onChange={(e) => updateSettings((s) => (s.ai.openaiKey = e.target.value.trim()))} />
              </Field>
              <Field label="OpenAI model">
                <TextInput value={settings.ai.openaiModel ?? 'gpt-5'} onChange={(v) => updateSettings((s) => (s.ai.openaiModel = v.trim()))} />
              </Field>
            </div>
          </Card>
        )}

        {tab === 'saving' && <SavingCard />}
        {tab === 'keys' && <ShortcutsCard />}
        {tab === 'performance' && <PerformanceCard />}
        {tab === 'library' && <Library embedded />}
        {tab === 'developer' && <DeveloperInfo />}

        {tab === 'backup' && (
          <Card title="Backup & restore">
            <p className="mb-3 text-sm text-stone-600">All data is stored on this device. Export a backup file regularly, or to move your quotes and price library to another phone.</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary"
                onClick={() => shareTextFile(`woodquote-backup-${todayISO()}.json`, JSON.stringify(exportData()), 'application/json')}
              >
                <Download size={16} /> Export backup
              </button>
              <button className="btn-secondary" onClick={() => importRef.current?.click()}>
                <Upload size={16} /> Restore backup
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const raw = JSON.parse(await f.text());
                    // backups from any version: plain exports, save points and Windows backup files
                    if (!isWoodQuoteData(raw)) throw new Error('Not a WoodQuote backup');
                    const data = normalizeData(raw);
                    if (confirmAction(`Replace all data on this device with this backup (${data.quotes.length} quotations, ${data.invoices.length} invoices)? You can undo this.`)) importData(data);
                  } catch (err) {
                    alert(`Could not restore: ${(err as Error).message}`);
                  }
                }}
              />
            </div>
          </Card>
        )}
      </div>
      )}
    </div>
  );
}
