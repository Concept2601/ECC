# WoodQuote by 2601 — joinery quotation app for Android

WoodQuote by 2601 prices TV stands, kitchen cabinets, kitchen centre islands, built-in cabinets, fitted wardrobes (hinged or sliding), bookshelves, vanities and custom units. It also produces 3D renders, cut plans, quotations, invoices and receipts.

It is a React + TypeScript app packaged for Android with Capacitor. All data stays on the device (IndexedDB) and the app works offline. Only the AI diagram reader needs internet.

## Features

| Area | What it does |
| --- | --- |
| **Parametric units** | 11 starting templates. Every unit is split into bays (columns), and each bay into compartments. A compartment can be open, have 1 or 2 doors, 1 or 2 aluminium-framed glass doors, 1–8 drawers, or a lift-up flap. You can add adjustable shelves and hanging rails, choose plinth, legs or no base, add a countertop (islands get a seating overhang) and add sliding doors (board, glass or mirror). |
| **Visual editor** | A front view with dimensions. Tap a compartment to change it. Drag the blue handles to resize bays and the orange handles to resize compartments. You can split or merge bays and compartments, and type exact sizes in mm. A live 3D view you can rotate sits beside it; you can hide the doors to see inside. |
| **3D render** | Built with three.js using wood-grain or plain finishes, glass, mirror, aluminium frames, handles, legs and countertops. Renders go into the quotation PDF. |
| **Quotation intelligence** | Every unit produces a full cut list (part, L×W×T, quantity, material, metres of edging) and a hardware list. The hardware list counts hinges per door height, runners (sized automatically to the cabinet depth within the chosen family), handles, legs, rollers, tracks, rails, flap stays, shelf pins, screws (in boxes) and cam locks. You can override any quantity or add accessories. |
| **Cut optimiser** | Packs all parts in the job onto sheets per board type. It allows for saw kerf, edge trim and grain direction. There are two modes: guillotine (panel saw) and nested (CNC). For each board it shows the number of sheets, the % used, the cost of what goes into parts, the value of reusable offcuts and the cost of what is lost to waste, with a diagram of every sheet. You choose whether the quote charges full sheets or full sheets minus reusable offcuts. Aluminium profiles are cut from stock lengths in the same way (1D). |
| **Price library** | Boards, edge banding, glass, aluminium, countertops, accessories (each with its own sizes, pack quantities and prices) and transport options are all editable. |
| **Pricing** | Markup, labour (% of materials or a fixed price per unit, with a per-unit override), installation, transport and extra lines, discount (% or amount), and tax. Material costs are spread back across the units so that unit prices always add up to the quote total. |
| **Documents** | PDF quotation, workshop cut list, invoice and receipt. You can set the logo and its position, accent colour, company block, custom header fields and text, footer, page numbers, bank details, terms per document type, titles and number prefixes. |
| **Invoices & receipts** | Turn a quote into an invoice in one tap. You can still adjust the lines, discount and tax, set the deposit (% or amount) and record payments. Each payment gets a numbered receipt showing the previous payments, this payment and the balance left. |
| **Diagram reader** | Upload or photograph a plan, elevation, sketch, 3D render or PDF. Claude reads it and returns units with dimensions, bays, fronts and finishes, plus a confidence level and the assumptions it made. You can review them and turn them into a quotation with renders. Without an API key, you can trace over the image in the visual editor instead. |
| **Backup** | Export or restore all data as a JSON file. |

## Getting the APK

* **GitHub Actions:** every push that changes `woodquote/` runs `.github/workflows/woodquote-android.yml`. That workflow runs the tests, builds the web app, syncs Capacitor and produces `WoodQuote-debug-apk`. Download it from the run's *Artifacts* section and install it on your phone (allow "install unknown apps").
* **Locally (Android Studio):**
  ```bash
  cd woodquote
  npm install
  npm run android:sync     # build web app + copy into android/
  npm run android:open     # opens Android Studio → Run ▶ or Build › Build APK
  ```
  You need JDK 21 and the Android SDK (API 36).

## Development

```bash
npm install
npm run dev      # http://localhost:5173 (works in any browser)
npm test         # engine unit tests (generator, optimiser, pricing, invoices, AI mapping)
npm run build
```

### Code map

* `src/lib/types.ts`: the data model
* `src/lib/presets.ts`: templates for each product type
* `src/lib/generate.ts`: turns a unit into parts, hardware, aluminium cuts and 3D boxes
* `src/lib/optimizer.ts`: sheet packing (guillotine and MaxRects) and 1D bar packing
* `src/lib/pricing.ts`: quote and invoice maths, including cost allocation
* `src/render/scene.ts`: three.js scene and still renders
* `src/components/ElevationEditor.tsx`: the visual editor
* `src/pdf/pdf.ts`: PDF documents
* `src/ai/vision.ts`: diagram reader (Claude, structured output)

## Diagram reader setup

Create an API key at <https://console.anthropic.com/settings/keys> and paste it into **Settings → Diagram reader (AI)**. The key is stored only on the device, and the app calls the Anthropic API directly. The default model is `claude-opus-5-5`.
