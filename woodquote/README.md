# En-Quote — joinery, ceilings and tiling quotations

En-Quote (formerly WoodQuote by 2601) runs on Android, iPhone, Windows and the web.

WoodQuote by 2601 prices TV stands, kitchen cabinets, kitchen centre islands, built-in cabinets, fitted wardrobes (hinged or sliding), bookshelves, vanities and custom units. It also produces 3D renders, cut plans, quotations, invoices and receipts.

It is a React + TypeScript app packaged for Android with Capacitor. All data stays on the device (IndexedDB) and the app works offline. Only the AI diagram reader needs internet.

## Features

| Area | What it does |
| --- | --- |
| **Workspaces** | A loading page prepares everything, then you choose **Joinery**, **Ceilings** or **Tiling**. A left side bar switches workspace and moves around the app. One quotation can hold all three trades, each in its own section. |
| **Ceilings** | Rhinoboard and PVC ceilings per room: boards / strips, brandering and nails, screws or clips, jointing, cornices or trims, paint, insulation, designs (bulkheads, trays, shadow lines, LED coves), light cut-outs, removal of old ceilings, and add-ons like pendants, chandeliers and transport. |
| **Tiling** | Floors and walls per room: tile type, size, colour and price per box, laying pattern and waste, boxes, adhesive and grout by weight, spacers, levelling clips, trims, skirting, waterproofing, silicone, screed, removal of old tiles, labour and add-ons. |
| **Single units** | 11 templates: TV stand, kitchen base / wall / tall, centre island, built-in cabinet, hinged and sliding wardrobes, bookshelf, vanity and custom. Each unit can be **built-in** (fixed to walls) or **standalone**. It can stand on the **floor** (kick board, legs, or no legs so it sits straight on the floor) or hang on a **wall** at a height you set. |
| **Corner cupboards** | Base and wall-hung corner cupboards with a separate width on each wall (Width A and Width B), L-shaped with two doors or diagonal with one door, return on either side. Use them alone or at the corners of L and U kitchens. |
| **Islands & cabinet groups** | Islands with cupboards on **four sides, two sides or one side** (back panel or seating overhang). Any unit made of several cabinets: each cabinet placed anywhere and facing **front, back, left, right or any angle**, under one shared worktop, quoted as one item. Loose free-standing appliances (fridge, stove, washing machine, dryer, bins, TV…) are items too. |
| **Cabinet rows & wall slats** | BIC walls, wardrobe walls, TV wall units and display walls built cabinet by cabinet like a kitchen run. Slatted wall panelling fixed with silicone and wall anchors, on its own or behind TV stands, kitchens and BICs. |
| **Services** | Installation, delivery, site measure, plumbing, electrical and any other non-design item on the quotation, from your own services price list. |
| **Room-first quoting** | Draw the room, then add doors, windows, openings, appliances, kitchens, islands, cabinets, wardrobes, BICs, TV stands and displays straight onto the plan; the quotation fills itself. |
| **Kitchen runs** | A whole kitchen quoted as **one item**. Layouts are **straight, L-shaped or U-shaped**, and you choose which wall runs into each corner. Each wall is a row of linked modules: base cabinets (doors, drawers, sink, hob + oven, integrated dishwasher, bin or spice pull-out, magic corner) with optional wall cabinets above, tall cabinets (pantry, oven + microwave tower, integrated fridge) and gaps for free-standing fridges or stoves. The run sets the worktop height, depths, kick board, wall-cabinet height and tall height for every cabinet, and the worktop runs continuously across the base cabinets. Tap any cabinet to design it in full. |
| **Fronts** | Compartments are **split on their own**: splitting one side by side or top / bottom adds a partition or shelf only inside that compartment, and the rest of the unit is unchanged (splits can be nested and merged back). Each compartment can be open, a door, drawers, sliding, or an appliance housing. Doors can be **wood/board, aluminium-framed glass or frameless glass**. Opening options are **hinged left, hinged right, pair, flap up or flap down**, and sliding fronts move **left, right or as a by-passing pair**. Fittings are **full overlay, half overlay or inset**, chosen from icon buttons. Hinges are matched automatically to the fitting type. |
| **Sides, back, top & base** | Exposed **finish panels** on the left, right and back in any board, with a **flat, shaker, fluted or slatted** design, optionally running down to the floor. **Countertop or board-top overhang** is set separately for the front, back, left and right. **Kick boards** can go on any side, with an adjustable recess. |
| **Lighting** | LED strips, aluminium profiles, puck spots and light bars. They can go under the cabinet, inside the top of a bay, under each shelf, along the plinth, on top as an up-light, on the back panel, or at a **custom position** (any x / height / depth, horizontal or vertical, shining down, up or forward). Colour temperatures run from 2700K to 6500K, or choose an RGB colour. Door, hand-wave and touch sensors are available, and a driver is added automatically. A **night view** in the 3D render shows the light glowing. |
| **Appliances** | Kept as separate categories: stoves, stove hobs, downdraft extractors, ovens, microwaves, fridges, dishwashers, washing machines, hoods, sinks and wine coolers. **Stove hobs:** 2, 4, 5 and 6 plate gas; 4, 5 and 6 plate electric; induction and gas/electric combination. Each hob can have a **downdraft extractor**, and its distance from the worktop front edge and from the unit's left edge can be set (warnings when it is closer than 50mm to an edge). Other appliances: single, double and undermount sinks; built-in ovens and microwaves; integrated and free-standing dishwashers; single-door, top-freezer, side-by-side, French-door, integrated and under-counter fridges; wine coolers; chimney and built-in hoods; washing machines; free-standing stoves. Hobs and sinks add a worktop cut-out charge. You choose whether appliances are supplied by you (and priced) or by the client. |
| **Accessories** | **Handles:** notched (round, oval, trapezium), bar, T-bar, knob, Roman, finger pull, Gola profile, appliance pull, and push-to-open systems. **Runners:** Trimax, soft-close, ordinary ball-bearing, push-to-open, undermount and roller. **Hinges:** soft-close, ordinary, kitchen, corner 165°, BIC and reliant corner. **Pull-outs:** spice rack, trash bin, vegetable baskets, pantry pull-out, carousel and magic corner. Every item has its own sizes and prices. |
| **Visual editor** | The 3D render stays fixed on screen while the settings scroll underneath. Tap any part of the 3D model to edit that compartment. 3D camera views: 3D, front, left, right, back and top. 3D tools: hide doors, **open doors and drawers** (shows the opening direction) and lights on. The 2D editor has **front, left, right, back and top** views: drag handles on the front view to resize, and tap a side, the back, the top or the base to edit it. |
| **Render quality** | Studio reflections make **gloss, satin, matte and textured** finishes look different. Wood grain is drawn for timber boards, and glass, mirror and metal have their own materials. Built-in units and kitchens are shown against room walls. |
| **Cut optimiser** | All parts in the job are packed onto sheets for each board type, allowing for saw kerf, edge trim and grain direction. Modes are guillotine (panel saw) and nested (CNC). For each board you see the sheets needed, the value used in parts, reusable offcuts and waste. Aluminium profiles are cut from stock lengths in the same way. |
| **Pricing** | Markup, labour (% of materials or per unit), installation, transport, extra lines, discount and tax. Costs are spread back across each unit and kitchen so the item prices always add up to the total. |
| **Room layout** | A room planner for each quotation. Start from a rectangle, L-shaped or angled-corner room, then edit **each wall's length, direction (any angle, with ±45° / ±90° buttons) and height**. Add or remove walls, and use **Close the room** to fit the last wall back to the first corner. Set the wall thickness and colours. Add **windows** (sill and head height), **doors** and **open-plan openings with an optional RC beam** (set its depth). Place every unit and kitchen in the room: drag them on the plan, rotate them, or push them against a wall. Walls can be cut away so the client can see in. A room page with a 3D view and a dimensioned plan is added to the quotation PDF. |
| **Documents** | Quotation PDF with 3D renders and dimensioned drawings, including an elevation of each kitchen wall. Your **attached designs** (photos, sketches, mood boards, or captured render views including the lighting view) go on their own pages. Also a workshop cut list, invoice and receipt. The header and footer are fully customisable. |
| **PDF download** | Every quotation, cut list, invoice and receipt PDF can be **downloaded to the phone** (Documents/WoodQuote) or shared to WhatsApp, email and so on. |
| **Invoices & receipts** | Turn a quote into an invoice in one tap, adjust it, set the deposit, record payments and issue receipts showing the balance remaining. |
| **Diagram reader** | Claude reads a plan, sketch, photo, 3D render or PDF and returns units with fronts, opening directions, appliances, hobs and sinks. |
| **Backup & upgrades** | Export or restore all data. Quotes and price libraries saved by older versions are upgraded automatically, and new catalogue items are added without overwriting your prices. |

## Licensing

The app opens only with a licence: the customer's email plus a 6-digit code from the developer's authenticator app. Each code unlocks 30 days. See [LICENSING.md](LICENSING.md) for how to issue codes and set your own master key. The version history is in [CHANGELOG.md](CHANGELOG.md) and inside the app under Settings › Developer information.

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

## Windows PC (64-bit)

The same app runs as a Windows desktop program (Electron, in `desktop/`).

* **GitHub Actions:** `.github/workflows/woodquote-windows.yml` builds `WoodQuote-Windows-x64` with two files:
  * `WoodQuote-Setup-<version>-x64.exe`: installer with Start-menu and desktop shortcuts.
  * `WoodQuote-Portable-<version>-x64.exe`: runs without installing (e.g. from a USB stick).
* Quotes are stored on the PC. **Save to this PC** asks where to save PDFs (starting in `Documents\WoodQuote`); **Open to print or email** opens the PDF in the default viewer.
* The exe is not code-signed yet, so Windows SmartScreen shows "Windows protected your PC" the first time: click **More info → Run anyway**. Add a code-signing certificate as the secrets `WIN_CSC_LINK` (base64 .pfx) and `WIN_CSC_KEY_PASSWORD` to sign it.
* Locally: `npm run desktop:start` (run) or `npm run desktop:win` (build the .exe; on Windows).

## iPhone / iPad

The iOS project is in `ios/` (Capacitor, Swift Package Manager). Building needs a Mac with Xcode, so `.github/workflows/woodquote-ios.yml` builds it on a GitHub macOS runner.

* **Without an Apple Developer account:** the run uploads `WoodQuote-iOS-unsigned` (`WoodQuote-unsigned.ipa`). Install it from a Windows PC or Mac with a sideloading tool such as Sideloadly or AltStore, using your Apple ID. With a free Apple ID the app must be re-installed every 7 days.
* **With an Apple Developer account (US$99/year):** add these repository secrets and the run also produces a signed App Store build and, with the API key, uploads it to TestFlight:
  * `IOS_TEAM_ID`: your 10-character team ID
  * `IOS_P12_BASE64`, `IOS_P12_PASSWORD`: an *Apple Distribution* certificate exported as .p12 (base64)
  * `IOS_PROFILE_BASE64`: an *App Store* provisioning profile for `zw.co.zuslyprojects.woodquote` (base64)
  * `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`: an App Store Connect API key (for TestFlight upload)
* PDFs saved with **Download** appear in the Files app under *On My iPhone › WoodQuote*.
* On a Mac: `npm run ios:sync` then `npm run ios:open` and press Run in Xcode.

## Development

```bash
npm install
npm run dev      # http://localhost:5173 (works in any browser)
npm test         # engine unit tests (generator, optimiser, pricing, invoices, AI mapping)
npm run build
```

### Code map

* `src/lib/types.ts`: the data model
* `src/lib/presets.ts`: templates for each product type, plus the upgrade step for older saved data
* `src/lib/room.ts`: room layout (walls, openings, placing items)
* `src/pages/RoomDesigner.tsx`: the room planner
* `desktop/`: Windows desktop shell (Electron)
* `ios/`, `android/`: native iPhone and Android projects (Capacitor)
* `src/lib/ceilings.ts`, `src/lib/tiling.ts`, `src/lib/trades.ts`: ceilings and tiling quantities and costs
* `src/components/CeilingsEditor.tsx`, `src/components/TilingEditor.tsx`: their quotation sections
* `src/components/Splash.tsx`, `Launcher.tsx`, `Sidebar.tsx`: loading page, workspace chooser and side bar
* `src/lib/runs.ts`: kitchen runs (straight, L and U shapes, modules, worktops, layout)
* `src/lib/assembly.ts`: cabinet groups and islands (pieces facing any way, shared worktop)
* `src/pages/AssemblyDesigner.tsx`: the island / cabinet group designer
* `src/components/RoomPalette.tsx`: “Add to the room” palette
* `src/lib/generate.ts`: turns a unit into parts, hardware, aluminium cuts and 3D boxes
* `src/lib/optimizer.ts`: sheet packing (guillotine and MaxRects) and 1D bar packing
* `src/lib/pricing.ts`: quote and invoice maths, including cost allocation
* `src/render/scene.ts`: three.js scene and still renders
* `src/components/ElevationEditor.tsx`: the 2D editor (front, sides, back and top)
* `src/pages/RunDesigner.tsx`: the kitchen designer
* `src/pdf/pdf.ts`: PDF documents
* `src/ai/vision.ts`: diagram reader (Claude, structured output)

## Diagram reader setup

Create an API key at <https://console.anthropic.com/settings/keys> and paste it into **Settings → Diagram reader (AI)**. The key is stored only on the device, and the app calls the Anthropic API directly. The default model is `claude-opus-5-5`.
