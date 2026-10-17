// Licence screen (shown until the app is activated) and the developer's
// licence manager for issuing codes from an authenticator app.
import { KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import { DEVELOPER } from '../app/developer';
import { activate, checkDevPin, LICENSE_DAYS, licenceState, secretFor, setupFor, stepAt, totp, type LicenceState } from '../app/license';

export function LicenceManager() {
  const [pin, setPin] = useState('');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open || !email.includes('@')) return void setSetup(null);
    let alive = true;
    void (async () => {
      const s = await setupFor(email);
      const qr = await QRCode.toDataURL(s.uri, { margin: 1, width: 220 });
      if (alive) setSetup({ ...s, qr });
    })();
    const tick = async () => alive && setCode(await totp(await secretFor(email), stepAt()));
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open, email]);
  if (!open)
    return (
      <div className="flex gap-2">
        <input className="input" type="password" inputMode="numeric" placeholder="Developer PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button className="btn-secondary" onClick={async () => ((await checkDevPin(pin)) ? (setOpen(true), setErr('')) : setErr('Wrong PIN'))}>
          <KeyRound size={16} /> Open
        </button>
        {err && <span className="self-center text-xs text-red-600">{err}</span>}
      </div>
    );
  return (
    <div className="space-y-3 text-sm">
      <input className="input" type="email" placeholder="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {setup && (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <img src={setup.qr} alt="Scan with your authenticator app" className="rounded-xl border border-stone-200" />
          <div className="space-y-2">
            <p>
              <b>Add this customer to your authenticator app:</b> scan the QR code, or choose “Enter a setup key” and type the key below (time based).
            </p>
            <div className="break-all rounded-lg bg-stone-100 p-2 font-mono text-xs">{setup.secret}</div>
            <p>
              To activate or renew, read the customer the 6-digit code your app shows for <b>{email.trim().toLowerCase()}</b>. Each code unlocks {LICENSE_DAYS} days.
            </p>
            <p className="text-xs text-stone-500">
              Code right now: <span className="font-mono text-base font-bold text-stone-800">{code}</span> (changes every 30 s; accepted for about 2 minutes)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Screen({ state, onDone }: { state: LicenceState & { ok: false }; onDone: () => void }) {
  const [email, setEmail] = useState(state.licence?.email ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dev, setDev] = useState(false);
  const msg =
    state.reason === 'expired'
      ? `Your licence for ${state.licence?.email} ended on ${new Date(state.licence!.expiresAt).toLocaleDateString()}. Enter a new code to carry on — all your quotes are kept.`
      : state.reason === 'clock'
        ? 'The device clock was set back. Correct the date and time, then try again — or enter a new code.'
        : state.reason === 'invalid'
          ? 'The licence on this device is not valid. Enter a code to activate again.'
          : 'Enter the email this copy is licensed to and the 6-digit code from the developer.';
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <img src="./favicon.svg" className="h-12 w-12" />
          <div>
            <div className="text-lg font-bold">{DEVELOPER.product}</div>
            <div className="text-xs text-stone-500">Licensed software</div>
          </div>
        </div>
        <p className="flex gap-2 text-sm text-stone-700">
          <Lock size={16} className="mt-0.5 shrink-0 text-brand-600" /> {msg}
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr('');
            try {
              await activate(email, code);
              onDone();
            } catch (x) {
              setErr((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">6-digit code</span>
            <input className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} />
          </label>
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Activate for {LICENSE_DAYS} days
          </button>
        </form>
        <p className="text-xs text-stone-500">
          Need a code? Contact the developer, <b>{DEVELOPER.name}</b> ({DEVELOPER.country}), with the email above.
        </p>
        <button className="text-xs text-stone-400 underline" onClick={() => setDev(!dev)}>
          Developer
        </button>
        {dev && <LicenceManager />}
      </div>
    </div>
  );
}

/** Shows the app only while the licence is valid; re-checks every few minutes. */
export default function LicenceGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenceState | null>(null);
  const check = () => void licenceState().then(setState);
  useEffect(() => {
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  if (!state) return <div className="flex h-full items-center justify-center text-stone-400">Checking licence…</div>;
  if (!state.ok) return <Screen state={state} onDone={check} />;
  return <>{children}</>;
}

/** Licence status for Settings and the dashboard. */
export function useLicence() {
  const [state, setState] = useState<LicenceState | null>(null);
  useEffect(() => {
    void licenceState().then(setState);
  }, []);
  return state;
}
