// Version history shown in Settings › Developer information (also CHANGELOG.md).
export interface Release {
  version: string;
  date: string;
  title: string;
  added?: string[];
  updated?: string[];
  upgraded?: string[];
  fixed?: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.2.0',
    date: '2026-10-23',
    title: "Islands, cabinet groups and room-first quoting",
    added: [
      "Islands with cupboards on four sides, two sides (back to back) or one side (with a back panel or a seating overhang)",
      "Cabinet groups: build any unit from several cabinets – each one placed anywhere and facing front, back, left, right or any angle – quoted as one item with a shared worktop",
      "Loose free-standing appliances as their own items: fridge, chest freezer, stove, microwave, dishwasher, washing machine, top-loader, tumble dryer, bins and TV",
      "Start a quotation from the room: draw the room, then add doors, windows, openings, appliances, kitchens, islands, cabinets, wardrobes, BICs, TV stands and displays straight onto the plan",
      "Corners of L and U kitchens: choose which wall runs into each corner",
      "One-tap “Switch to” buttons to change a cabinet’s type (base, wall, tall, corner, wardrobe, BIC…) keeping its width, materials and handles; kitchen slots switch between base, tall, open space and filler",
    ],
    updated: [
      "Room plan: face items front, back, left, right or any angle, open an item’s designer from the plan and remove items from the quotation there",
      "Plan reader turns islands into islands with cupboards on the right number of sides and stand-alone fridges / stoves into appliances",
      "Quotation PDF shows 3D, top and back views of islands and cabinet groups",
    ],
    fixed: [
      "Number boxes no longer change or add up figures while you type or after you clear them: what you type stays until you pause, press Enter / Tab or leave the box; the mouse wheel no longer changes them",
      "The price library is kept exactly as you leave it: deleted materials no longer come back and edited prices are no longer replaced by defaults after restarting",
      "Freezing while typing or dragging: work is now saved once you pause instead of on every key press, and dragging on room / group plans only saves when you let go",
      "Work is saved immediately when the app is sent to the background or closed; the device is asked to keep the app’s data permanently",
      "Duplicated quotations keep their room layout",
    ],
  },
  {
    version: '2.1.0',
    date: '2026-10-17',
    title: 'Corner cupboards',
    added: [
      'Corner base and corner wall cupboards with their own width on each wall (Width A and Width B), as standalone units or in kitchens',
      'Two styles: L-shaped with two doors meeting in the corner, or diagonal with one angled door; return on the left- or right-hand wall',
      'Corner cupboards build their full cut list: L-shaped or five-sided bottoms, tops and shelves, two backs, end panels, kick boards, L-shaped or diagonal worktop, corner hinges, bi-fold link and optional carousel',
    ],
    updated: [
      'L and U kitchens now start with real corner cupboards (base and wall); the next wall’s cabinets start after the corner’s Width B, with a worktop return over the corner',
      'Kitchen “Base design” list includes L and diagonal corner cupboards; the selected cabinet shows Width B and the corner style',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-17',
    title: 'Licensing and the new four-tab layout',
    added: [
      'Licensing: the app opens with an email + 6-digit code from the developer’s authenticator app; each code unlocks 30 days, renewing early keeps the days left',
      'Developer licence manager (PIN protected) with a QR code per customer, plus a command-line licence tool',
      'Dashboard tab: open quotations, drafts (latest 5), closed / invoiced quotations, invoices and receipts, quoted-per-month chart, win rate, quick tools and a + button for a new quotation',
      'Material hub in each quotation: every material and fitting grouped by use, change any of them for the whole job, appliances in drop-downs grouped by type',
      'Reporting tab: all PDF exports, render views, invoice creation and a cost summary in one place',
      'New invoice picker: choose the quotation to invoice from a list (or a blank invoice)',
      'Invoice deviations: extras and credits for work that changed after quoting, each with its reason, shown on the invoice PDF',
      'Developer information: developer, licence status, version history, usage and privacy policies, documentation and hardware requirements for every device type',
    ],
    updated: [
      'Bottom tabs are now Dashboard, Quotation, Invoices and Settings',
      'Quotation tabs: Client details, Design, Material hub, Costing, Material schedule, Reporting',
      'Settings grouped into Customization, Material pricing hub, Diagram (AI) reader, Software backup and Developer information',
    ],
    upgraded: ['Backups, save points and Windows backup files from every earlier version restore and are upgraded automatically (settings, rooms, kitchens, numbering)'],
  },
  {
    version: '1.5.0',
    date: '2026-10-17',
    title: 'Works like desktop software',
    added: [
      'Undo / redo for every change (Ctrl+Z / Ctrl+Y) with buttons in every header',
      'Keyboard shortcuts for all main commands, re-assignable in Settings; Windows menu bar (File, Edit, View, Design, Help)',
      'Save (Ctrl+S) with restorable save points; auto-save every 1–240 minutes; Windows backup files',
      'Insert a cabinet, space, wall-only cabinet, filler or appliance space of any size anywhere in a kitchen; measured wall length with space left and auto-fill',
      'Measure a space: enter W × H × D to see what fits, units sized to fill it and a kitchen that uses the wall exactly',
      'Plan reader: PDF or drawing → room outline, measurements, BICs, kitchen, island, sink and stove positions, design checks and ideas (Anthropic, OpenAI, or paste from ChatGPT)',
      'Refresh (F5) without losing work; render quality setting (phone saver to maximum)',
    ],
    upgraded: [
      'Parts bigger than the board or plank are cut in equal pieces with a joint method, fixings and cleats instead of an error; slat width and gap are adjustable',
      'Recalculation about 30× faster; 3D only redraws while it moves',
      'Windows app uses the main graphics card, GPU drawing and more memory, and offers to reload if it ever stops responding',
    ],
    fixed: ['Android: the app closing itself on heavy 3D (thumbnail memory leak, lighter phone defaults, recovery from lost graphics, larger memory allowance)', 'Hob and sink no longer warn about the worktop edge on standard kitchens'],
  },
  {
    version: '1.4.0',
    date: '2026-10-13',
    title: 'Windows and iPhone',
    added: ['Windows 64-bit app (installer and portable .exe)', 'iPhone / iPad app (Capacitor iOS) with Files-app PDF saving'],
  },
  {
    version: '1.3.0',
    date: '2026-10-13',
    title: 'Independent compartments and editable rooms',
    added: ['Room walls with any length, direction and height; L-shaped and angled rooms; close the room'],
    updated: ['Splitting a compartment only divides that compartment; splits can be nested and merged'],
  },
  {
    version: '1.2.0',
    date: '2026-10-13',
    title: 'Rooms, hobs and downloads',
    added: [
      'Room layout with wall heights, windows, doors and open-plan openings with RC beams',
      'Separate appliance categories; 2–6 plate gas and electric hobs with downdraft extractors',
      'Hob / sink distance from the worktop edges; custom light positions',
      'Quotation, invoice and receipt PDFs download to the device',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-13',
    title: 'Kitchens and finishes',
    added: [
      'Linked kitchen runs (straight, L, U) with wall, base and tall cabinets',
      'Side and back finish panels, overhangs, kick boards, legs or no legs',
      'Lighting (types, colour temperatures, colours), gloss / matte rendering',
      'Wood and glass doors with opening directions, flaps and sliding doors',
      'Handles, push-to-open, runners, hinges and kitchen accessories; built-in or standalone units',
      'Designs attached to quotations; tap the 3D render to edit',
    ],
    updated: ['App renamed to WoodQuote by 2601'],
  },
  {
    version: '1.0.0',
    date: '2026-10-13',
    title: 'First release',
    added: [
      'Quotations for TV stands, kitchen units, islands, built-ins and wardrobes with 3D render and visual editor',
      'AI diagram reader (plan, sketch or 3D → priced units)',
      'Custom quotation header and footer; invoices and receipts with discount, deposit and balance',
      'Editable material, transport, glass and aluminium costs; cutting optimiser with used vs lost cost; bill of materials with accessories',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
