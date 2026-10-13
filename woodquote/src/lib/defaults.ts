import type { Catalog, Settings } from './types';

// Starter price library. Every value is editable in the app (Library screen).
export const defaultCatalog = (): Catalog => ({
  boards: [
    { id: 'b-mel16-white', name: 'Melamine chipboard white 16mm', category: 'Melamine', thickness: 16, sheetLength: 2750, sheetWidth: 1830, pricePerSheet: 42, color: '#f2f0ea', grain: false, texture: 'plain' },
    { id: 'b-mel16-oak', name: 'Melamine chipboard oak 16mm', category: 'Melamine', thickness: 16, sheetLength: 2750, sheetWidth: 1830, pricePerSheet: 48, color: '#b88a5a', grain: true, texture: 'wood' },
    { id: 'b-mdf18', name: 'MDF raw 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 45, color: '#c9a97c', grain: false, texture: 'plain' },
    { id: 'b-mdf18-walnut', name: 'MDF walnut veneer 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 78, color: '#6b4429', grain: true, texture: 'wood' },
    { id: 'b-mdf18-gloss', name: 'MDF high gloss grey 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 95, color: '#5d6066', grain: false, texture: 'plain' },
    { id: 'b-hmr18', name: 'HMR moisture resistant 18mm', category: 'HMR', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 60, color: '#9fae8c', grain: false, texture: 'plain' },
    { id: 'b-ply18', name: 'Plywood 18mm', category: 'Plywood', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 55, color: '#d8b98a', grain: true, texture: 'wood' },
    { id: 'b-pine32', name: 'Pine laminated board 32mm', category: 'Solid wood', thickness: 32, sheetLength: 2400, sheetWidth: 600, pricePerSheet: 65, color: '#dcb57c', grain: true, texture: 'wood' },
    { id: 'b-hb3', name: 'Hardboard white 3mm (backs)', category: 'Hardboard', thickness: 3, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 12, color: '#efece4', grain: false, texture: 'plain' },
  ],
  edging: [
    { id: 'e-white', name: 'PVC edging white 22mm', pricePerMeter: 0.6, color: '#f2f0ea' },
    { id: 'e-oak', name: 'PVC edging oak 22mm', pricePerMeter: 0.75, color: '#b88a5a' },
    { id: 'e-walnut', name: 'PVC edging walnut 22mm', pricePerMeter: 0.85, color: '#6b4429' },
    { id: 'e-grey', name: 'ABS edging grey 2mm', pricePerMeter: 1.2, color: '#5d6066' },
  ],
  glass: [
    { id: 'g-clear4', name: 'Clear glass 4mm', thickness: 4, pricePerSqm: 25, color: '#cfe8ef', opacity: 0.3 },
    { id: 'g-frost6', name: 'Frosted glass 6mm', thickness: 6, pricePerSqm: 38, color: '#e6f0f2', opacity: 0.7 },
    { id: 'g-tint6', name: 'Bronze tinted glass 6mm', thickness: 6, pricePerSqm: 42, color: '#7a5a3a', opacity: 0.5 },
    { id: 'g-mirror4', name: 'Mirror 4mm', thickness: 4, pricePerSqm: 32, color: '#d9e2e6', opacity: 0.95 },
  ],
  aluminium: [
    { id: 'a-frame-silver', name: 'Door frame profile silver', stockLength: 6000, pricePerLength: 28, color: '#c0c4c8' },
    { id: 'a-frame-black', name: 'Door frame profile matt black', stockLength: 6000, pricePerLength: 34, color: '#2b2b2b' },
    { id: 'a-frame-gold', name: 'Door frame profile champagne', stockLength: 6000, pricePerLength: 36, color: '#c8a96a' },
  ],
  countertops: [
    { id: 'c-postform', name: 'Postform laminate top 38mm', thickness: 38, pricePerSqm: 45, color: '#d9d4c7' },
    { id: 'c-granite', name: 'Granite (black galaxy) 30mm', thickness: 30, pricePerSqm: 120, color: '#26262a' },
    { id: 'c-quartz', name: 'Quartz white 20mm', thickness: 20, pricePerSqm: 180, color: '#f4f4f2' },
    { id: 'c-wood', name: 'Solid hardwood top 40mm', thickness: 40, pricePerSqm: 140, color: '#a8743f' },
  ],
  accessories: [
    { id: 'h-softclose', category: 'hinge', name: 'Soft-close clip-on hinge', size: '35mm full overlay', unit: 'pc', packQty: 1, price: 2.5 },
    { id: 'h-standard', category: 'hinge', name: 'Standard concealed hinge', size: '35mm full overlay', unit: 'pc', packQty: 1, price: 0.9 },
    { id: 'h-halfov', category: 'hinge', name: 'Soft-close hinge', size: '35mm half overlay', unit: 'pc', packQty: 1, price: 2.6 },
    { id: 'h-glass', category: 'hinge', name: 'Hinge for aluminium frame door', size: '26mm', unit: 'pc', packQty: 1, price: 4 },
    { id: 'h-165', category: 'hinge', name: 'Wide angle corner hinge', size: '165°', unit: 'pc', packQty: 1, price: 6 },

    { id: 'r-bb350', category: 'runner', family: 'Ball bearing full extension', name: 'Ball bearing runner', size: '350mm', lengthMm: 350, unit: 'pair', packQty: 1, price: 6 },
    { id: 'r-bb400', category: 'runner', family: 'Ball bearing full extension', name: 'Ball bearing runner', size: '400mm', lengthMm: 400, unit: 'pair', packQty: 1, price: 6.5 },
    { id: 'r-bb450', category: 'runner', family: 'Ball bearing full extension', name: 'Ball bearing runner', size: '450mm', lengthMm: 450, unit: 'pair', packQty: 1, price: 7 },
    { id: 'r-bb500', category: 'runner', family: 'Ball bearing full extension', name: 'Ball bearing runner', size: '500mm', lengthMm: 500, unit: 'pair', packQty: 1, price: 8 },
    { id: 'r-bb550', category: 'runner', family: 'Ball bearing full extension', name: 'Ball bearing runner', size: '550mm', lengthMm: 550, unit: 'pair', packQty: 1, price: 9 },
    { id: 'r-um400', category: 'runner', family: 'Soft-close undermount', name: 'Soft-close undermount runner', size: '400mm', lengthMm: 400, unit: 'pair', packQty: 1, price: 20 },
    { id: 'r-um450', category: 'runner', family: 'Soft-close undermount', name: 'Soft-close undermount runner', size: '450mm', lengthMm: 450, unit: 'pair', packQty: 1, price: 22 },
    { id: 'r-um500', category: 'runner', family: 'Soft-close undermount', name: 'Soft-close undermount runner', size: '500mm', lengthMm: 500, unit: 'pair', packQty: 1, price: 24 },
    { id: 'r-roller350', category: 'runner', family: 'Epoxy roller runner', name: 'Epoxy roller runner', size: '350mm', lengthMm: 350, unit: 'pair', packQty: 1, price: 2.5 },
    { id: 'r-roller450', category: 'runner', family: 'Epoxy roller runner', name: 'Epoxy roller runner', size: '450mm', lengthMm: 450, unit: 'pair', packQty: 1, price: 3 },

    { id: 'ro-std', category: 'roller', name: 'Sliding door roller set (top + bottom)', size: 'up to 40kg', unit: 'set', packQty: 1, price: 15 },
    { id: 'ro-heavy', category: 'roller', name: 'Heavy duty sliding roller set', size: 'up to 80kg', unit: 'set', packQty: 1, price: 28 },
    { id: 'ro-softclose', category: 'roller', name: 'Soft-close sliding roller set', size: 'up to 60kg', unit: 'set', packQty: 1, price: 35 },

    { id: 't-std', category: 'track', name: 'Sliding track top + bottom', size: 'double track', unit: 'm', packQty: 1, price: 14 },
    { id: 't-heavy', category: 'track', name: 'Heavy duty sliding track set', size: 'double track', unit: 'm', packQty: 1, price: 22 },

    { id: 'hd-bar128', category: 'handle', name: 'Bar handle stainless', size: '128mm', unit: 'pc', packQty: 1, price: 2 },
    { id: 'hd-bar192', category: 'handle', name: 'Bar handle stainless', size: '192mm', unit: 'pc', packQty: 1, price: 2.8 },
    { id: 'hd-bar320', category: 'handle', name: 'Bar handle matt black', size: '320mm', unit: 'pc', packQty: 1, price: 5 },
    { id: 'hd-knob', category: 'handle', name: 'Round knob', size: '30mm', unit: 'pc', packQty: 1, price: 1 },
    { id: 'hd-gola', category: 'handle', name: 'Gola / J-profile handle', size: 'per metre', unit: 'm', packQty: 1, price: 6 },
    { id: 'hd-push', category: 'handle', name: 'Push-to-open latch', size: 'handleless', unit: 'pc', packQty: 1, price: 3 },

    { id: 's-4x16', category: 'screw', name: 'Chipboard screws 4x16', size: 'box of 200', unit: 'pc', packQty: 200, price: 3 },
    { id: 's-4x35', category: 'screw', name: 'Chipboard screws 4x35', size: 'box of 200', unit: 'pc', packQty: 200, price: 4 },
    { id: 's-confirmat', category: 'screw', name: 'Confirmat screws 7x50', size: 'box of 100', unit: 'pc', packQty: 100, price: 6 },

    { id: 'cn-cam', category: 'connector', name: 'Cam lock & dowel set', size: '15mm', unit: 'set', packQty: 1, price: 0.25 },
    { id: 'cn-dowel', category: 'connector', name: 'Wooden dowels 8x30', size: 'bag of 100', unit: 'pc', packQty: 100, price: 2 },

    { id: 'sp-std', category: 'shelfPin', name: 'Shelf support pins', size: '5mm', unit: 'pc', packQty: 1, price: 0.05 },

    { id: 'l-adj100', category: 'leg', name: 'Adjustable plinth leg', size: '100-150mm', unit: 'pc', packQty: 1, price: 1.5 },
    { id: 'l-chrome150', category: 'leg', name: 'Chrome furniture leg', size: '150mm', unit: 'pc', packQty: 1, price: 4 },
    { id: 'l-hairpin', category: 'leg', name: 'Hairpin leg black', size: '200mm', unit: 'pc', packQty: 1, price: 6 },

    { id: 'rl-oval', category: 'rail', name: 'Oval wardrobe rail chrome', size: '25mm', unit: 'm', packQty: 1, price: 5 },
    { id: 'rl-pullout', category: 'rail', name: 'Pull-down wardrobe lift', size: '830-1150mm', unit: 'pc', packQty: 1, price: 45 },

    { id: 'st-flap', category: 'stay', name: 'Lift-up flap stay', size: 'soft close', unit: 'pc', packQty: 1, price: 8 },
    { id: 'st-gas', category: 'stay', name: 'Gas strut', size: '80N', unit: 'pc', packQty: 1, price: 4 },

    { id: 'lk-cam', category: 'lock', name: 'Cupboard cam lock', size: '20mm', unit: 'pc', packQty: 1, price: 3 },
    { id: 'lt-led', category: 'lighting', name: 'LED strip warm white', size: 'per metre', unit: 'm', packQty: 1, price: 6 },
  ],
});

export const defaultSettings = (): Settings => ({
  company: {
    name: 'Your Joinery Co.',
    tagline: 'Custom cabinets • Kitchens • Wardrobes',
    address: '123 Workshop Road\nHarare, Zimbabwe',
    phone: '+263 77 000 0000',
    email: 'sales@example.com',
    website: '',
    taxNumber: '',
    logo: null,
  },
  pricing: {
    currency: '$',
    taxRate: 15,
    taxLabel: 'VAT',
    markupPercent: 35,
    labourMode: 'percent',
    labourPercent: 30,
    labourPerUnit: 80,
    installationPercent: 10,
    kerf: 4,
    sheetTrim: 10,
    minOffcut: 200,
    boardCharging: 'fullSheets',
    cutMode: 'guillotine',
    edgingWastePercent: 10,
    screwsPerJoint: 4,
    transportOptions: [
      { id: 'tr-local', name: 'Local delivery (within 20km)', price: 30 },
      { id: 'tr-city', name: 'City-wide delivery', price: 60 },
      { id: 'tr-long', name: 'Long distance (quoted)', price: 150 },
    ],
  },
  doc: {
    accentColor: '#8a5a2b',
    logoPosition: 'left',
    headerText: '',
    headerFields: [],
    footerText: 'Thank you for your business!',
    showPageNumbers: true,
    bankDetails: '',
    quoteTitle: 'QUOTATION',
    invoiceTitle: 'INVOICE',
    receiptTitle: 'RECEIPT',
    quoteTerms:
      '1. A 60% deposit is required to confirm the order.\n2. Balance is payable on completion before installation.\n3. Lead time is 2-4 weeks from deposit.\n4. Prices may change if measurements or materials change.',
    invoiceTerms: 'Please pay the balance due by the due date shown above.',
    receiptNote: 'Received with thanks.',
    quoteValidityDays: 14,
    showRenders: true,
    showElevations: true,
    quoteDetail: 'units',
    signatureLine: true,
    quotePrefix: 'QUO-',
    invoicePrefix: 'INV-',
    receiptPrefix: 'RCT-',
  },
  ai: { apiKey: '', model: 'claude-opus-5-5' },
});
