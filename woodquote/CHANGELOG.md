# WoodQuote by 2601 — version history

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
