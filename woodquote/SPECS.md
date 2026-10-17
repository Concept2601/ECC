# WoodQuote by 2601 — specification sheet

**Version 2.0.0** · Developer **sir.2601**, Zimbabwe · *Made with passion and love by a crazy mind.*

Joinery quotation software for TV stands, kitchens, islands, built-in cupboards (BICs) and wardrobes. It covers 3D design, room layouts, AI plan reading, cutting optimisation, material schedules, quotations, invoices and receipts.

## Platforms and builds

| Platform | Package | Built by |
| --- | --- | --- |
| Windows 10 / 11, 64-bit | Installer `WoodQuote-Setup-2.0.0-x64.exe` and portable `WoodQuote-Portable-2.0.0-x64.exe` | GitHub Actions › *WoodQuote Windows app* |
| Android 7.0+ | APK (`WoodQuote-debug-apk`); Play Store AAB once release signing is set up | GitHub Actions › *WoodQuote Android APK* |
| iPhone / iPad, iOS 15+ | Unsigned `.ipa` (sideload); App Store / TestFlight build once Apple signing secrets are added | GitHub Actions › *WoodQuote iPhone app* |
| Web browser | Same app, runs from any web host | `npm run build` |

## Hardware requirements

| Device | Minimum | Recommended |
| --- | --- | --- |
| **Windows PC** | Windows 10 64-bit; dual-core 2 GHz; 4 GB RAM; graphics with DirectX 11 / WebGL 2 (integrated is fine); 500 MB disk; 1366 × 768 screen | Windows 11; 4+ cores (Intel i5 / Ryzen 5 or better); 8–16 GB RAM; dedicated graphics with 2 GB+ video memory; SSD; 1920 × 1080 or larger |
| **Android phone / tablet** | Android 7.0; 3 GB RAM; OpenGL ES 3.0; 200 MB free; render quality *Phone / battery saver* | Android 11+; 6–8 GB RAM; Snapdragon 7-series / Dimensity 700+ / Helio G90+ or better; 1 GB free; render quality *Balanced* (8 GB RAM) |
| **iPhone / iPad** | iOS / iPadOS 15; iPhone 8 / XR or newer (A11); 3 GB RAM; 200 MB free | iOS 17+; iPhone 12 or newer (A14+), iPad Air / Pro; 4–6 GB RAM; 1 GB free |
| **Web browser** | Chrome / Edge 110+, Safari 16+, Firefox 115+; WebGL 2; 4 GB RAM | Latest Chrome or Edge; 8 GB RAM; hardware acceleration on |

- **Internet:** only needed for the AI diagram and plan readers. Everything else works offline, including the licence check.
- **Camera (optional):** for photographing plans and sketches.
- **Printer (optional):** PDFs print from any PDF viewer.

## Performance

| Item | Detail |
| --- | --- |
| Render quality settings | Phone / battery saver (1× resolution, no shadows, low-power GPU) · Balanced (1.5×, 1024 shadows) · High (2×, 2048 shadows, main GPU) · Maximum (up to 3×, 4096 shadows) |
| 3D drawing | Draws only while the view moves or the design changes, so an idle view uses no graphics power; views off-screen pause |
| Recalculation | Unchanged cabinets and cut plans are cached; a large quote recalculates in about 2 ms instead of 56 ms |
| Windows app | Main graphics card forced, GPU rasterisation and zero-copy on, up to 4 GB JavaScript memory, no background throttling; offers to reload if the window stops responding; restarts the page after a crash |
| Android | Large memory allowance, one shared renderer for thumbnails with memory freed after each picture, recovers from lost graphics instead of closing |
| Refresh | F5 / Ctrl+R reloads the app; work is kept |

## Data and files

| Item | Detail |
| --- | --- |
| Storage | On the device (IndexedDB); nothing is sent to the developer |
| Undo / redo | Up to 150 steps; typing and dragging group into one step |
| Save points | Ctrl+S, plus auto-save every 1–240 minutes (default 5); last 20 automatic and 30 manual points kept; Windows also writes `Documents\WoodQuote\Backups\*.json` (newest 30) |
| Backup / restore | JSON export and import; restores backups, save points and Windows backup files from every earlier version (upgraded automatically) |
| PDFs | Quotation (with 3D renders, room plan, attachments), workshop cut list and material schedule, invoice, receipt |
| Inputs | Photos and images (JPG, PNG, WebP) and PDFs for the AI readers |

## Licensing

| Item | Detail |
| --- | --- |
| Activation | Customer email + 6-digit code from the developer's authenticator app (TOTP, RFC 6238: 30 s, 6 digits, SHA-1) |
| Term | 30 days per code; renewing early adds to the days left; each code can be used once |
| Binding | Per email, signed licence record per device; setting the clock back is detected |
| Developer tools | In-app licence manager (PIN) with a QR code per customer; `tools/license.mjs` on the command line |
| Network | None needed (offline check) |

## AI readers

| Reader | Input | Output | Services |
| --- | --- | --- | --- |
| Diagram reader | Sketch, plan, photo or 3D render (image / PDF) | Priced units with bays, fronts and appliances | Anthropic API key |
| Plan reader | Floor-plan PDF, drawing or photo | Room outlines with measurements (area, perimeter, wall area), doors and windows, BICs, kitchen runs, islands, sinks, stoves, fridges; design checks and ideas; opens as a room layout with the joinery quoted | Anthropic or OpenAI API key, or ChatGPT (Plus / Pro) by copy-and-paste |

## Fabrication engine

- Parametric units: bays, compartments with independent nested splits, doors (wood, framed glass, frameless glass), drawers, flaps, sliding doors, appliance housings, lighting.
- Kitchens: straight, L and U runs. Cabinets, spaces, wall-only cabinets, fillers and appliance spaces of any size can go at any position. You can enter the measured wall length, and auto-fill adds a cabinet or filler for the space left.
- Cutting optimiser: guillotine (panel saw) or nested (CNC), with kerf, trim and grain. It shows used, reusable offcut and waste cost.
- Oversize parts are split into equal pieces with the join in the middle, not at the end. A joint method is chosen for where the part goes:
  - carcass tops and bottoms over a partition, with dowels and connector bolts
  - visible fronts with a V-groove shadow line and a backing cleat
  - backs on a rail
  - kick boards behind a leg
  - narrow planks or slats laid side by side on battens
- Fixings and cleats from the joins are added to the cut list and costs.

## Keyboard shortcuts (defaults, all re-assignable)

| Action | Keys | Action | Keys |
| --- | --- | --- | --- |
| New quotation | Ctrl+N | Undo / Redo | Ctrl+Z / Ctrl+Y, Ctrl+Shift+Z |
| New invoice | Ctrl+Shift+N | Duplicate | Ctrl+D |
| Measure a space | Ctrl+M | Delete selected | Delete |
| Save | Ctrl+S | Insert custom cabinet / space | Insert, Ctrl+I |
| PDF | Ctrl+P | Previous / next cabinet | ← / → |
| Refresh | F5, Ctrl+R | Move selected | Ctrl+← / Ctrl+→ |
| Dashboard / Quotations / Invoices / Prices / Settings | Ctrl+1 … Ctrl+5, Ctrl+, | Design selected | Enter, F2 |
| Back | Alt+← | Add unit / kitchen / room layout | Ctrl+U / Ctrl+K / Ctrl+L |
| Keyboard help | F1, Ctrl+/ | Close dialog | Esc |

## Technology

React 19 + TypeScript, Vite, Tailwind CSS, three.js (WebGL 2), jsPDF, Zustand with IndexedDB storage, Capacitor 8 (Android and iOS), Electron (Windows), Anthropic and OpenAI APIs.
