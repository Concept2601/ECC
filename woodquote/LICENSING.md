# WoodQuote licensing — how it works and how to issue codes

WoodQuote only opens with a licence. A licence is tied to the customer's **email address** and lasts **30 days**. You (the developer) unlock or renew it by giving the customer a **6-digit code from your authenticator app** (Google Authenticator, Microsoft Authenticator, Authy…).

## How it works

- Every customer email gets its own secret, worked out from your **master key** and the email. So a code from that customer's entry in your authenticator only works for that email.
- The codes are standard time-based codes (TOTP: 6 digits, 30 seconds, SHA-1), so any authenticator app shows them. The app accepts a code for about 2 minutes, so you can read it out over the phone or WhatsApp.
- Entering a code gives **30 days**. Renewing before the end adds 30 days to the days that are left. Each code can only be used once.
- When the licence ends, the app shows the licence screen. **No data is lost.** The customer enters a new code and carries on.
- Setting the device clock back to stretch the licence is detected.
- Everything runs on the device; no internet or server is needed.

## Issue a licence (in the app)

1. On any copy of WoodQuote: **Settings › Developer information › Licence › Developer: issue licence codes** (or tap **Developer** on the licence screen).
2. Enter the developer PIN (default **260126**; change it below).
3. Type the customer's email. A **QR code** and **setup key** appear.
4. In your authenticator app: **Add account → Scan QR code** (or **Enter a setup key**, account name = the email, time based).
5. Whenever that customer needs to activate or renew, read them the 6-digit code your app shows for their email. They enter their email and the code.

The licence manager also shows the current code, so you can issue one without the authenticator if needed.

## Issue a licence (command line)

```bash
cd woodquote
node tools/license.mjs setup customer@example.com   # setup key + otpauth link for your authenticator
node tools/license.mjs code  customer@example.com   # the current 6-digit code
node tools/license.mjs pin   123456                 # hash for a new developer PIN
```

## Use your own master key and PIN (recommended)

The default master key is in the source code, so anyone with the code could make codes. Set your own before giving the app out:

1. Choose a long random master key, and a developer PIN. Run `node tools/license.mjs pin <your PIN>` to get the PIN hash.
2. In GitHub: **repository › Settings › Secrets and variables › Actions › New repository secret**:
   - `WQ_LICENSE_KEY`: your master key
   - `WQ_DEV_PIN_HASH`: the PIN hash
3. Push, or re-run the Android / Windows / iPhone workflows. The builds use your key and PIN.
4. When using the command-line tool, set the same key: `WQ_LICENSE_KEY=<your key> node tools/license.mjs code customer@example.com`.

Changing the master key gives every customer a new secret: add them to your authenticator again, and they need a new code (licences already running on their devices also stop, because the stored licence is signed with the key).

## Limits

The check runs inside the app, so a determined person who extracts the master key from the app files could make their own codes. For stronger protection, a small licence server can check codes instead. The app is built so that check can be moved to a server later.
