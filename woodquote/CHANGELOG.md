# En-Quote — version history

_En-Quote was called WoodQuote by 2601 up to version 2.3._

## 3.1.5 — Simpler, cleaner screens (2026-11-20)

### Updated
- Quotation design tab: Unit, Kitchen and Island / row / slats / appliance buttons on one row; room layout and “Render the whole room” in one slim card
- Cabinet designer: one slim toolbar with 3D / 2D / Both and a cabinet-type dropdown (replaces the row of type chips)
- Fewer, grouped tabs and full-width layouts carried through the kitchen, group and room designers

## 3.1.4 — Smoother Windows app, one cabinet editor at full width, snapping and new boards (2026-11-20)

### Added
- Snapping on the room plan: items snap against walls and each other while you drag, with your own snap distance and gap between them
- Equal widths / Equal heights buttons next to the compartment sizes
- 5mm back cover sheet (lighter and cheaper than board) and 32mm boards (melamine, MDF, chipboard) for bases and tops
- Settings › Developer information shows which graphics card the 3D uses, with a warning when it is drawn in software

### Updated
- Windows app: the 3D view stops drawing as soon as the view settles, shaders are no longer checked on every change, the desktop starts on Balanced quality, and computers without a usable graphics driver get a light 3D mode automatically — no more hiccups while editing
- After an equal split you can type a custom size for any part; the others keep sharing the rest equally (and Equal puts them back)
- One cabinet editor for every cabinet: kitchens, islands, TV stands and rows all open the same full designer with “Edit cabinet – all controls” first
- The editor uses the full screen width; related settings are grouped into 6 tabs (Layout & fronts, Size top & base, Sides & materials, Hardware & lighting, Appliances, Cut list) and sit side by side on wide screens
- Room plan: wall lengths on dimension lines outside the walls, labels sized to fit, window and door widths shown — no more overlapping labels

### Fixed
- Walls next to a cut-away wall end square instead of mitred

## 3.1.3 — Proper wall joints, partitions and pillars, any-shape kitchens and whole-room renders (2026-11-20)

### Added
- Partition walls (with an optional door gap) and pillars inside a room — close off a pantry or scullery, add a divider — on the plan, in 3D and in renders
- Add a wall at the end of the room by length and turn (left / right, any angle): build open or closed shapes with 4, 5, 8 or more walls
- “Kitchen row” on any wall: base cupboards under one worktop with wall cupboards above, the length of the wall, standing on it; tap it to edit its cabinets
- Kitchen row preset for cabinet rows
- Render the whole room: one button on the quotation opens the render studio on the full room — every kitchen, BIC, TV unit and partition in place, with walls, windows and doors
- Ceiling in room renders (seen from inside; never blocks the view from above)
- Tiled floor by default: 1200 × 1200 tiles in a colour chosen to go with the kitchen fronts; tile size, colour, wood or plain floor in Room & walls

### Fixed
- Wall ends are flat and walls meet in clean mitred corners in 3D and on the plan, instead of round posts and crossed walls

## 3.1.2 — Corner types, inner drawers, backsplashes, ceiling panels and the PG Bison colour range (2026-11-20)

### Added
- Board colours & textures database: PG Bison MelaWood solid colours and woodgrains and SupaGloss built in, with supplier, range and type; link each colour to the board types it comes on and add the supplier's swatch photos (PNG / JPG) for the exact look
- Four corner cupboard types: square (one solid L-shaped top and bottom), L (two-piece panels), diagonal, and blind corner (straight cabinet, blind panel, reach-in door, worktop joined round the corner); all available in kitchens too
- Inner drawers without fronts behind doors, opened with push-to-open runners or a notch cut in the front edge
- Several hanging rails in one compartment: they share the height equally, each under its own shelf, and each can be moved up or down
- TV base cabinet with no sides or top (for between tall cabinets), plus switches to leave out the sides, top or back of any cabinet
- Kitchen backsplash along every worktop in stone, Caesarstone, slate, tiles or a board, at the height you choose (auto up to the wall units)
- Optional panels or slats above the wall and tall units up to the ceiling (e.g. cabinets 2200, ceiling 2600 → 400mm)
- Wall panel / backsplash item for TV and media areas: any width and height in stone, tiles or board
- TV sizes 32" to 100" (including 41", 42", 46"), shown as a slim screen in 3D
- New worktop / splash materials: Caesarstone quartz, natural slate, subway, mosaic and porcelain slab tiles

### Updated
- Bins, racks, TVs and other non-standard appliances can be given their own width, height and depth per item; fridges, stoves, hobs, ovens and microwaves keep their standard sizes
- Choosing a board colour never changes the board type: the colour picker only offers colours that come on the cabinet's board
- Woodgrain colours show a grain in 3D even before you add the swatch photo

## 3.1.1 — Corner doors, better defaults, sums in measurement boxes and automatic fittings (2026-11-20)

### Added
- Sums in every measurement box: type 600+18, 2400-2*18 or (3000-60)/3 and press Enter; on phones + − × ÷ keys appear under the box
- Corner cupboard front drawing (unfolded main and side wall) next to the 3D view, using the same door layout as 3D
- Fittings added automatically: rail end supports, wall anchors for hanging brackets and built-in fixings, kick board clips, sliding door stoppers and bottom guides, buffers for push-to-open fronts
- Fridge spaces: switch to cover a fridge with a matching door (panel-ready fridges)

### Updated
- Corner cupboards behave like other cupboards: a door for every 600mm (or choose the number), hinged in pairs, wood, framed glass or frameless glass doors, or an open corner
- Handles default to push-to-open on new cabinets; choose a handle per cabinet when you want one
- Plinth / kick board height defaults to 100mm on kitchens and 160mm on wardrobes and BICs (still adjustable)
- Exposed side and back panels run down to the floor and follow the fronts board – change the fronts and they change too; make one shorter or give it its own board only when you choose
- Dividing a compartment or adding a bay shares the space equally (dividing twice gives three equal parts); sizes you typed or dragged are kept
- Fridges stand in an open housing instead of behind a cabinet door
- Boards keep their manufacturer's finish: the painted (spray) finishes and the finish-over-board option are removed

### Fixed
- Quotation, invoice and receipt titles sit on their own line above the details instead of running into the company and client details

## 3.1.0 — Render studio, finish library, custom sinks and a faster, split database (2026-11-19)

### Added
- Render studio (✦ button on every 3D view): lighting presets (Daylight, Studio white, Showroom, Warm evening, Night with lights on, Line drawing), sun direction, height, strength and colour, room light, exposure, soft shadows, shadow darkness, corner shading (ambient occlusion), reflections, matte or polished floor, backgrounds including transparent PNG, panel outlines
- Photoreal renders: a path tracer with true reflections in gloss, glass, metal and polished floors, soft shadows and light bouncing between cabinets – choose the number of samples, stop early and keep the result
- Image renders up to 4K, square and portrait sizes, saved to the quotation’s Renders and to the device
- Video export: turntable, half turn or a walk-through gliding between saved views, 4–60 seconds, 30 fps, up to 4K, as MP4 (WebM where MP4 is not available)
- Capture button on every 3D view: saves a high-resolution picture and the camera angle; saved views can be re-rendered or used in walk-through videos
- Renders library on each quotation: save to device (Documents/En-Quote/Renders on Windows and Android, Files app on iPhone), share, add to the quotation PDF or delete
- Finish library: colours and your own PNG / JPG textures (import single files, several or a whole folder), gloss / satin / matt / textured / metallic surfaces, real texture size in mm, grain direction and a finishing price per m²; 16 starter finishes including high gloss solid wood in red, cream and blue
- Front and carcass finish per cabinet (Materials tab) or for the whole job (Material hub); boards and worktops can carry a finish too
- Custom sinks: any width and depth, layouts such as bowl + drainer, two drainers with a bowl, double bowl, 1½ bowl, stainless / granite composite / ceramic in any colour, inset or undermount, tap position – drawn the same in 3D and in drawings

### Updated
- Zoom follows the pointer or pinch point instead of always zooming into the middle; double-click / double-tap a spot to turn and zoom around it
- Drawings show finish colours
- Finishing work appears as its own “Finishes” group in costs and the material schedule

### Upgraded
- Database split into separate stores: settings, price lists, invoices and one record per quotation, with finish textures and renders in their own stores – only what changed is saved, so big jobs no longer slow every edit
- Prices, cut lists and 3D builds are worked out in the background, so typing, dragging and the 3D view never wait for big kitchens
- Very big jobs (e.g. a kitchen repeated for a block of flats) work out their sheet layouts in seconds instead of minutes, and screens keep showing the last figures while new ones are worked out
- Edits copy quotations without duplicating photos and logos, and 3D panels of the same size share their shapes and materials – much less memory on big kitchens

## 3.0.0 — En-Quote: Joinery, Ceilings and Tiling in one app (2026-10-25)

### Added
- New name and look: En-Quote, with a new logo, app icons and launch screens
- Loading page that opens your data, loads every screen and works out all quotation totals before the app opens
- Workspace chooser when the app opens: Joinery, Ceilings or Tiling (can be skipped), and a left side bar to switch workspaces and move around (slides in on phones)
- Ceilings: rhinoboard and PVC ceilings per room – boards or strips, brandering at your centres with nails into the trusses, screws / clips, joint tape and filler, cornices or PVC wall trims with adhesive, paint and coats with colour, insulation, light cut-outs, designs (bulkheads, trays, shadow lines, LED coves, access hatches…), removal of old ceilings, and add-ons such as pendants, chandeliers, downlights, fans, transport, rubble removal and scaffolding
- Tiling: floors and walls per room – tile type, size, colour, finish and price per box, laying pattern with matching waste, tiles and boxes, adhesive and grout by weight, spacers, levelling clips, trims, tile skirting, waterproofing, primer, silicone, screed, removal of old tiles, and add-ons such as transport, steps, niches and sealing
- Labour rates, markup, waste and price lists for ceilings and tiling in Settings › Price lists
- One quotation can hold Joinery, Ceilings and Tiling; the quotation PDF shows each as its own numbered section with a subtotal, and a summary of all sections
- Invoices made from a quotation include every ceiling and tiling room and their add-ons

### Updated
- Quotation PDF redesigned: the logo is set into the letterhead beside the company details, title in spaced capitals with a neat reference block, clean tables, numbered sections and a refined totals panel; invoices and receipts share the new look
- Dashboard and quotation lists show which trades each quotation includes, with filters

### Upgraded
- Much faster start-up: screens, the 3D engine and the PDF engine load only when needed (the start-up download is about a fifth of its old size)
- Lists no longer recalculate every quotation each time they open – totals are remembered until something changes

## 2.3.0 — Cabinet rows, wall slats, services, hobs with downdrafts (2026-10-23)

### Added
- Cabinet rows: BIC walls, wardrobe walls, TV wall units and display walls built like a kitchen run – cabinets side by side in order, + to add one anywhere, move left / right, gaps, wall-hung pieces above
- Wall slats fixed straight onto the wall with silicone and wall anchors: slat width, gap, board and optional backing board; slats, anchors and silicone are counted and priced; on their own or behind TV stands, kitchens and BICs
- Services & other items on every quotation (installation, delivery, site measure, plumbing, electrical, removal…), picked from a saved price list with units (day, trip, m²…) or typed in
- Services price list in Settings › Material pricing hub › Services
- Hob or sink and its downdraft extractor can be chosen right on a kitchen cabinet and on island / group cabinets

### Updated
- Islands: exposed ends (and the back of one-sided islands) are one board across the whole island instead of separate cabinet sides; panels can be switched on or off per side
- Island hobs and sinks sit in the shared worktop with their cut-outs charged
- Hobs with a downdraft move forward to leave room behind; if the worktop is too shallow the app says how deep it must be and can deepen the kitchen worktop in one tap
- Library: wall anchors and silicone / construction adhesive

### Fixed
- Hobs were missing from the appliance choices on kitchens and islands
- Rebuilding an island no longer makes it grow

## 2.2.0 — Islands, cabinet groups and room-first quoting (2026-10-23)

### Added
- Islands with cupboards on four sides, two sides (back to back) or one side (with a back panel or a seating overhang)
- Cabinet groups: build any unit from several cabinets – each one placed anywhere and facing front, back, left, right or any angle – quoted as one item with a shared worktop
- Loose free-standing appliances as their own items: fridge, chest freezer, stove, microwave, dishwasher, washing machine, top-loader, tumble dryer, bins and TV
- Start a quotation from the room: draw the room, then add doors, windows, openings, appliances, kitchens, islands, cabinets, wardrobes, BICs, TV stands and displays straight onto the plan
- Corners of L and U kitchens: choose which wall runs into each corner
- One-tap “Switch to” buttons to change a cabinet’s type (base, wall, tall, corner, wardrobe, BIC…) keeping its width, materials and handles; kitchen slots switch between base, tall, open space and filler

### Updated
- Room plan: face items front, back, left, right or any angle, open an item’s designer from the plan and remove items from the quotation there
- Plan reader turns islands into islands with cupboards on the right number of sides and stand-alone fridges / stoves into appliances
- Quotation PDF shows 3D, top and back views of islands and cabinet groups

### Fixed
- Number boxes no longer change or add up figures while you type or after you clear them: what you type stays until you pause, press Enter / Tab or leave the box; the mouse wheel no longer changes them
- The price library is kept exactly as you leave it: deleted materials no longer come back and edited prices are no longer replaced by defaults after restarting
- Freezing while typing or dragging: work is now saved once you pause instead of on every key press, and dragging on room / group plans only saves when you let go
- Work is saved immediately when the app is sent to the background or closed; the device is asked to keep the app’s data permanently
- Duplicated quotations keep their room layout

## 2.1.0 — Corner cupboards (2026-10-17)

### Added
- Corner base and corner wall cupboards with their own width on each wall (Width A and Width B), as standalone units or in kitchens
- Two styles: L-shaped with two doors meeting in the corner, or diagonal with one angled door; return on the left- or right-hand wall
- Corner cupboards build their full cut list: L-shaped or five-sided bottoms, tops and shelves, two backs, end panels, kick boards, L-shaped or diagonal worktop, corner hinges, bi-fold link and optional carousel

### Updated
- L and U kitchens now start with real corner cupboards (base and wall); the next wall’s cabinets start after the corner’s Width B, with a worktop return over the corner
- Kitchen “Base design” list includes L and diagonal corner cupboards; the selected cabinet shows Width B and the corner style

## 2.0.0 — Licensing and the new four-tab layout (2026-10-17)

### Added
- Licensing: the app opens with an email + 6-digit code from the developer’s authenticator app; each code unlocks 30 days, renewing early keeps the days left
- Developer licence manager (PIN protected) with a QR code per customer, plus a command-line licence tool
- Dashboard tab: open quotations, drafts (latest 5), closed / invoiced quotations, invoices and receipts, quoted-per-month chart, win rate, quick tools and a + button for a new quotation
- Material hub in each quotation: every material and fitting grouped by use, change any of them for the whole job, appliances in drop-downs grouped by type
- Reporting tab: all PDF exports, render views, invoice creation and a cost summary in one place
- New invoice picker: choose the quotation to invoice from a list (or a blank invoice)
- Invoice deviations: extras and credits for work that changed after quoting, each with its reason, shown on the invoice PDF
- Developer information: developer, licence status, version history, usage and privacy policies, documentation and hardware requirements for every device type

### Updated
- Bottom tabs are now Dashboard, Quotation, Invoices and Settings
- Quotation tabs: Client details, Design, Material hub, Costing, Material schedule, Reporting
- Settings grouped into Customization, Material pricing hub, Diagram (AI) reader, Software backup and Developer information

### Upgraded
- Backups, save points and Windows backup files from every earlier version restore and are upgraded automatically (settings, rooms, kitchens, numbering)

## 1.5.0 — Works like desktop software (2026-10-17)

### Added
- Undo / redo for every change (Ctrl+Z / Ctrl+Y) with buttons in every header
- Keyboard shortcuts for all main commands, re-assignable in Settings; Windows menu bar (File, Edit, View, Design, Help)
- Save (Ctrl+S) with restorable save points; auto-save every 1–240 minutes; Windows backup files
- Insert a cabinet, space, wall-only cabinet, filler or appliance space of any size anywhere in a kitchen; measured wall length with space left and auto-fill
- Measure a space: enter W × H × D to see what fits, units sized to fill it and a kitchen that uses the wall exactly
- Plan reader: PDF or drawing → room outline, measurements, BICs, kitchen, island, sink and stove positions, design checks and ideas (Anthropic, OpenAI, or paste from ChatGPT)
- Refresh (F5) without losing work; render quality setting (phone saver to maximum)

### Upgraded
- Parts bigger than the board or plank are cut in equal pieces with a joint method, fixings and cleats instead of an error; slat width and gap are adjustable
- Recalculation about 30× faster; 3D only redraws while it moves
- Windows app uses the main graphics card, GPU drawing and more memory, and offers to reload if it ever stops responding

### Fixed
- Android: the app closing itself on heavy 3D (thumbnail memory leak, lighter phone defaults, recovery from lost graphics, larger memory allowance)
- Hob and sink no longer warn about the worktop edge on standard kitchens

## 1.4.0 — Windows and iPhone (2026-10-13)

### Added
- Windows 64-bit app (installer and portable .exe)
- iPhone / iPad app (Capacitor iOS) with Files-app PDF saving

## 1.3.0 — Independent compartments and editable rooms (2026-10-13)

### Added
- Room walls with any length, direction and height; L-shaped and angled rooms; close the room

### Updated
- Splitting a compartment only divides that compartment; splits can be nested and merged

## 1.2.0 — Rooms, hobs and downloads (2026-10-13)

### Added
- Room layout with wall heights, windows, doors and open-plan openings with RC beams
- Separate appliance categories; 2–6 plate gas and electric hobs with downdraft extractors
- Hob / sink distance from the worktop edges; custom light positions
- Quotation, invoice and receipt PDFs download to the device

## 1.1.0 — Kitchens and finishes (2026-10-13)

### Added
- Linked kitchen runs (straight, L, U) with wall, base and tall cabinets
- Side and back finish panels, overhangs, kick boards, legs or no legs
- Lighting (types, colour temperatures, colours), gloss / matte rendering
- Wood and glass doors with opening directions, flaps and sliding doors
- Handles, push-to-open, runners, hinges and kitchen accessories; built-in or standalone units
- Designs attached to quotations; tap the 3D render to edit

### Updated
- App renamed to WoodQuote by 2601

## 1.0.0 — First release (2026-10-13)

### Added
- Quotations for TV stands, kitchen units, islands, built-ins and wardrobes with 3D render and visual editor
- AI diagram reader (plan, sketch or 3D → priced units)
- Custom quotation header and footer; invoices and receipts with discount, deposit and balance
- Editable material, transport, glass and aluminium costs; cutting optimiser with used vs lost cost; bill of materials with accessories
