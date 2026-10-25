import type { CeilingProduct, CeilingRates, PresetItem, ServiceItem, TileProduct, TileSupply, TilingRates, Accessory, Appliance, Catalog, Settings } from './types';

const acc = (a: Omit<Accessory, 'packQty' | 'unit'> & Partial<Pick<Accessory, 'packQty' | 'unit'>>): Accessory => ({ unit: 'pc', packQty: 1, ...a });

const runnerFamily = (prefix: string, family: string, name: string, prices: Record<number, number>, unit: Accessory['unit'] = 'pair'): Accessory[] =>
  Object.entries(prices).map(([len, price]) => acc({ id: `${prefix}${len}`, category: 'runner', family, name, size: `${len}mm`, lengthMm: Number(len), unit, price }));

const hingeFamily = (prefix: string, family: string, name: string, prices: Partial<Record<'overlay' | 'half' | 'inset', number>>): Accessory[] =>
  (Object.entries(prices) as ['overlay' | 'half' | 'inset', number][]).map(([fit, price]) =>
    acc({ id: `${prefix}-${fit}`, category: 'hinge', family, fit, name, size: fit === 'overlay' ? '35mm full overlay' : fit === 'half' ? '35mm half overlay' : '35mm inset', price }),
  );

export const defaultAppliances = (): Appliance[] => [
  // stove hobs: gas and electric, 2 to 6 plates
  { id: 'ap-hob-gas2', category: 'hob', name: 'Gas hob 2 plate (domino)', variant: 'Gas', plates: 2, width: 300, height: 50, depth: 520, price: 95, color: '#1d1d1f', placement: 'top' },
  { id: 'ap-hob-gas4', category: 'hob', name: 'Gas hob 4 plate', variant: 'Gas', plates: 4, width: 600, height: 50, depth: 520, price: 180, color: '#1d1d1f', placement: 'top' },
  { id: 'ap-hob-gas5', category: 'hob', name: 'Gas hob 5 plate', variant: 'Gas', plates: 5, width: 750, height: 50, depth: 520, price: 240, color: '#1d1d1f', placement: 'top' },
  { id: 'ap-hob-gas6', category: 'hob', name: 'Gas hob 6 plate', variant: 'Gas', plates: 6, width: 900, height: 50, depth: 520, price: 320, color: '#1d1d1f', placement: 'top' },
  { id: 'ap-hob-elec4', category: 'hob', name: 'Electric hob 4 plate', variant: 'Electric', plates: 4, width: 600, height: 50, depth: 520, price: 220, color: '#0d0d0f', placement: 'top' },
  { id: 'ap-hob-elec5', category: 'hob', name: 'Electric hob 5 plate', variant: 'Electric', plates: 5, width: 750, height: 50, depth: 520, price: 290, color: '#0d0d0f', placement: 'top' },
  { id: 'ap-hob-elec6', category: 'hob', name: 'Electric hob 6 plate', variant: 'Electric', plates: 6, width: 900, height: 50, depth: 520, price: 360, color: '#0d0d0f', placement: 'top' },
  { id: 'ap-hob-ind4', category: 'hob', name: 'Induction hob 4 zone', variant: 'Induction', plates: 4, width: 600, height: 50, depth: 520, price: 380, color: '#0d0d0f', placement: 'top' },
  { id: 'ap-hob-combo', category: 'hob', name: 'Gas + electric combo hob 4 plate', variant: 'Gas / electric', plates: 4, width: 600, height: 50, depth: 520, price: 240, color: '#1d1d1f', placement: 'top' },
  // downdraft extractors (rise out of the worktop behind the hob)
  { id: 'ap-dd-300', category: 'downdraft', name: 'Downdraft extractor 30cm', variant: 'Pop-up', width: 300, height: 300, depth: 90, price: 280, color: '#18181b', placement: 'top' },
  { id: 'ap-dd-600', category: 'downdraft', name: 'Downdraft extractor 60cm', variant: 'Pop-up', width: 600, height: 300, depth: 90, price: 520, color: '#18181b', placement: 'top' },
  { id: 'ap-dd-750', category: 'downdraft', name: 'Downdraft extractor 75cm', variant: 'Pop-up', width: 750, height: 300, depth: 90, price: 610, color: '#18181b', placement: 'top' },
  { id: 'ap-dd-900', category: 'downdraft', name: 'Downdraft extractor 90cm', variant: 'Pop-up', width: 900, height: 300, depth: 90, price: 690, color: '#18181b', placement: 'top' },
  { id: 'ap-sink-single', category: 'sink', name: 'Stainless sink single bowl + drainer', variant: 'Single bowl', width: 860, height: 200, depth: 500, price: 95, color: '#c9cdd2', placement: 'top' },
  { id: 'ap-sink-double', category: 'sink', name: 'Stainless sink double bowl', variant: 'Double bowl', width: 1160, height: 200, depth: 500, price: 150, color: '#c9cdd2', placement: 'top' },
  { id: 'ap-sink-undermount', category: 'sink', name: 'Undermount sink', variant: 'Undermount', width: 600, height: 200, depth: 450, price: 160, color: '#b5b9be', placement: 'top' },
  { id: 'ap-oven-elec', category: 'oven', name: 'Built-in electric oven', variant: 'Electric', width: 595, height: 595, depth: 550, price: 420, color: '#18181b', placement: 'inbuilt' },
  { id: 'ap-oven-gas', category: 'oven', name: 'Built-in gas oven', variant: 'Gas', width: 595, height: 595, depth: 550, price: 450, color: '#18181b', placement: 'inbuilt' },
  { id: 'ap-mw-built', category: 'microwave', name: 'Built-in microwave', variant: 'Built-in', width: 595, height: 390, depth: 400, price: 260, color: '#18181b', placement: 'inbuilt' },
  { id: 'ap-mw-counter', category: 'microwave', name: 'Countertop microwave', variant: 'Countertop', width: 480, height: 280, depth: 360, price: 110, color: '#2a2a2e', placement: 'freestanding' },
  { id: 'ap-dw-int', category: 'dishwasher', name: 'Integrated dishwasher 60cm', variant: 'Integrated', width: 598, height: 815, depth: 550, price: 480, color: '#d4d4d8', placement: 'inbuilt' },
  { id: 'ap-dw-free', category: 'dishwasher', name: 'Freestanding dishwasher 60cm', variant: 'Freestanding', width: 600, height: 850, depth: 600, price: 420, color: '#e4e4e7', placement: 'freestanding' },
  { id: 'ap-fr-single', category: 'fridge', name: 'Single door fridge', variant: 'Single door', width: 600, height: 1450, depth: 650, price: 380, color: '#d9dde1', placement: 'freestanding' },
  { id: 'ap-fr-topfreezer', category: 'fridge', name: 'Fridge, top freezer', variant: 'Double door', width: 700, height: 1750, depth: 680, price: 560, color: '#d9dde1', placement: 'freestanding' },
  { id: 'ap-fr-sbs', category: 'fridge', name: 'Side-by-side fridge', variant: 'Side by side', width: 910, height: 1780, depth: 720, price: 1150, color: '#c8ccd0', placement: 'freestanding' },
  { id: 'ap-fr-french', category: 'fridge', name: 'French door fridge', variant: 'French door', width: 910, height: 1800, depth: 730, price: 1450, color: '#c8ccd0', placement: 'freestanding' },
  { id: 'ap-fr-int', category: 'fridge', name: 'Integrated fridge-freezer', variant: 'Integrated', width: 560, height: 1770, depth: 550, price: 820, color: '#e4e4e7', placement: 'inbuilt' },
  { id: 'ap-fr-under', category: 'fridge', name: 'Under-counter fridge', variant: 'Under counter', width: 600, height: 820, depth: 580, price: 340, color: '#d9dde1', placement: 'inbuilt' },
  { id: 'ap-wine', category: 'wineCooler', name: 'Wine cooler 30 bottle', variant: 'Under counter', width: 300, height: 820, depth: 570, price: 420, color: '#18181b', placement: 'inbuilt' },
  { id: 'ap-hood-chimney', category: 'hood', name: 'Chimney extractor hood', variant: 'Chimney', width: 600, height: 700, depth: 480, price: 240, color: '#b5b9be', placement: 'freestanding' },
  { id: 'ap-hood-built', category: 'hood', name: 'Built-in (integrated) hood', variant: 'Built-in', width: 560, height: 180, depth: 280, price: 170, color: '#b5b9be', placement: 'inbuilt' },
  { id: 'ap-washer', category: 'washer', name: 'Front-load washing machine', variant: 'Front load', width: 600, height: 850, depth: 600, price: 520, color: '#f4f4f5', placement: 'inbuilt' },
  { id: 'ap-cooker-gas', category: 'cooker', name: 'Freestanding gas stove 4 burner', variant: 'Gas', width: 600, height: 900, depth: 600, price: 380, color: '#d4d4d8', placement: 'freestanding' },
  { id: 'ap-cooker-elec', category: 'cooker', name: 'Freestanding electric stove', variant: 'Electric', width: 600, height: 900, depth: 600, price: 360, color: '#e4e4e7', placement: 'freestanding' },
  // added in 2.2 for room plans
  { id: 'ap-washer-top', category: 'washer', name: 'Top-load washing machine', variant: 'Top load', width: 600, height: 950, depth: 620, price: 450, color: '#f4f4f5', placement: 'freestanding' },
  { id: 'ap-dryer', category: 'washer', name: 'Tumble dryer', variant: 'Dryer', width: 600, height: 850, depth: 600, price: 420, color: '#f4f4f5', placement: 'freestanding' },
  { id: 'ap-freezer-chest', category: 'fridge', name: 'Chest freezer', variant: 'Chest', width: 900, height: 850, depth: 650, price: 400, color: '#f4f4f5', placement: 'freestanding' },
  { id: 'ap-bin-pedal', category: 'other', name: 'Pedal bin 50 L', variant: 'Bin', width: 350, height: 650, depth: 350, price: 45, color: '#a1a1aa', placement: 'freestanding' },
  { id: 'ap-bin-twin', category: 'other', name: 'Twin recycling bin', variant: 'Bin', width: 600, height: 700, depth: 400, price: 85, color: '#a1a1aa', placement: 'freestanding' },
  { id: 'ap-tv-55', category: 'other', name: 'TV 55"', variant: 'TV', width: 1230, height: 710, depth: 80, price: 600, color: '#0b0b0d', placement: 'freestanding' },
];

/** Built-in library items added after 2.1, offered once to libraries saved by older versions. */
export const DEFAULTS_ADDED_LATER = ['fx-anchor', 'fx-silicone', 'ap-washer-top', 'ap-dryer', 'ap-freezer-chest', 'ap-bin-pedal', 'ap-bin-twin', 'ap-tv-55'];


export const defaultCatalog = (): Catalog => ({
  boards: [
    { id: 'b-mel16-white', name: 'Melamine chipboard white 16mm', category: 'Melamine', thickness: 16, sheetLength: 2750, sheetWidth: 1830, pricePerSheet: 42, color: '#f2f0ea', grain: false, texture: 'plain', finish: 'matte' },
    { id: 'b-mel16-oak', name: 'Melamine chipboard oak 16mm', category: 'Melamine', thickness: 16, sheetLength: 2750, sheetWidth: 1830, pricePerSheet: 48, color: '#b88a5a', grain: true, texture: 'wood', finish: 'textured' },
    { id: 'b-mel16-black', name: 'Melamine chipboard black 16mm', category: 'Melamine', thickness: 16, sheetLength: 2750, sheetWidth: 1830, pricePerSheet: 50, color: '#26262a', grain: false, texture: 'plain', finish: 'matte' },
    { id: 'b-mdf18', name: 'MDF raw 18mm (paint grade)', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 45, color: '#c9a97c', grain: false, texture: 'plain', finish: 'matte' },
    { id: 'b-mdf18-walnut', name: 'MDF walnut veneer 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 78, color: '#6b4429', grain: true, texture: 'wood', finish: 'satin' },
    { id: 'b-mdf18-gloss', name: 'MDF high gloss grey 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 95, color: '#5d6066', grain: false, texture: 'plain', finish: 'gloss' },
    { id: 'b-mdf18-gloss-white', name: 'MDF high gloss white 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 95, color: '#f7f7f5', grain: false, texture: 'plain', finish: 'gloss' },
    { id: 'b-mdf18-matte-green', name: 'MDF super matte sage 18mm', category: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 92, color: '#7d8c74', grain: false, texture: 'plain', finish: 'matte' },
    { id: 'b-hmr18', name: 'HMR moisture resistant 18mm', category: 'HMR', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 60, color: '#9fae8c', grain: false, texture: 'plain', finish: 'matte' },
    { id: 'b-ply18', name: 'Plywood 18mm', category: 'Plywood', thickness: 18, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 55, color: '#d8b98a', grain: true, texture: 'wood', finish: 'satin' },
    { id: 'b-pine32', name: 'Pine laminated board 32mm', category: 'Solid wood', thickness: 32, sheetLength: 2400, sheetWidth: 600, pricePerSheet: 65, color: '#dcb57c', grain: true, texture: 'wood', finish: 'satin' },
    { id: 'b-hb3', name: 'Hardboard white 3mm (backs)', category: 'Hardboard', thickness: 3, sheetLength: 2440, sheetWidth: 1220, pricePerSheet: 12, color: '#efece4', grain: false, texture: 'plain', finish: 'matte' },
  ],
  edging: [
    { id: 'e-white', name: 'PVC edging white 22mm', pricePerMeter: 0.6, color: '#f2f0ea' },
    { id: 'e-oak', name: 'PVC edging oak 22mm', pricePerMeter: 0.75, color: '#b88a5a' },
    { id: 'e-walnut', name: 'PVC edging walnut 22mm', pricePerMeter: 0.85, color: '#6b4429' },
    { id: 'e-grey', name: 'ABS edging grey 2mm', pricePerMeter: 1.2, color: '#5d6066' },
    { id: 'e-black', name: 'PVC edging black 22mm', pricePerMeter: 0.7, color: '#26262a' },
  ],
  glass: [
    { id: 'g-clear4', name: 'Clear glass 4mm', thickness: 4, pricePerSqm: 25, color: '#cfe8ef', opacity: 0.3 },
    { id: 'g-frost6', name: 'Frosted glass 6mm', thickness: 6, pricePerSqm: 38, color: '#e6f0f2', opacity: 0.7 },
    { id: 'g-tint6', name: 'Bronze tinted glass 6mm', thickness: 6, pricePerSqm: 42, color: '#7a5a3a', opacity: 0.5 },
    { id: 'g-toughened8', name: 'Toughened clear glass 8mm (frameless)', thickness: 8, pricePerSqm: 65, color: '#cfe8ef', opacity: 0.3 },
    { id: 'g-mirror4', name: 'Mirror 4mm', thickness: 4, pricePerSqm: 32, color: '#d9e2e6', opacity: 0.95 },
  ],
  aluminium: [
    { id: 'a-frame-silver', name: 'Door frame profile silver', stockLength: 6000, pricePerLength: 28, color: '#c0c4c8' },
    { id: 'a-frame-black', name: 'Door frame profile matt black', stockLength: 6000, pricePerLength: 34, color: '#2b2b2b' },
    { id: 'a-frame-gold', name: 'Door frame profile champagne', stockLength: 6000, pricePerLength: 36, color: '#c8a96a' },
  ],
  countertops: [
    { id: 'c-postform', name: 'Postform laminate top 38mm', thickness: 38, pricePerSqm: 45, color: '#d9d4c7', finish: 'matte' },
    { id: 'c-granite', name: 'Granite (black galaxy) 30mm', thickness: 30, pricePerSqm: 120, color: '#26262a', finish: 'gloss' },
    { id: 'c-quartz', name: 'Quartz white 20mm', thickness: 20, pricePerSqm: 180, color: '#f4f4f2', finish: 'gloss' },
    { id: 'c-wood', name: 'Solid hardwood top 40mm', thickness: 40, pricePerSqm: 140, color: '#a8743f', finish: 'satin' },
  ],
  appliances: defaultAppliances(),
  ceilingProducts: defaultCeilingProducts(),
  tiles: defaultTiles(),
  tileSupplies: defaultTileSupplies(),
  accessories: [
    // hinges
    ...hingeFamily('h-soft', 'Soft-close', 'Soft-close clip-on hinge', { overlay: 2.5, half: 2.6, inset: 2.8 }),
    ...hingeFamily('h-ord', 'Ordinary', 'Ordinary concealed hinge', { overlay: 0.9, half: 0.9, inset: 1 }),
    ...hingeFamily('h-kit', 'Kitchen hinge', 'Kitchen hinge 110° clip-on', { overlay: 1.6, half: 1.7, inset: 1.8 }),
    acc({ id: 'h-corner', category: 'hinge', family: 'Corner', fit: 'overlay', name: 'Corner hinge 165°', size: 'wide angle', price: 6 }),
    acc({ id: 'h-bic', category: 'hinge', family: 'BIC', fit: 'overlay', name: 'BIC hinge (blind inset corner)', size: '35mm', price: 4.5 }),
    acc({ id: 'h-reliant', category: 'hinge', family: 'Reliant corner', fit: 'overlay', name: 'Reliant corner hinge', size: 'bi-fold corner', price: 7 }),
    acc({ id: 'h-glass', category: 'hinge', family: 'Glass', fit: 'overlay', name: 'Hinge for aluminium frame door', size: '26mm', price: 4 }),
    acc({ id: 'h-glass-clamp', category: 'hinge', family: 'Glass', fit: 'overlay', name: 'Frameless glass clamp hinge', size: 'for 4-8mm glass', price: 7.5 }),
    // runners
    ...runnerFamily('r-bb', 'Ordinary ball bearing', 'Ordinary ball bearing runner', { 350: 4.5, 400: 5, 450: 5.5, 500: 6.5, 550: 7 }),
    ...runnerFamily('r-sc', 'Soft-close full extension', 'Soft-close ball bearing runner', { 350: 8, 400: 8.5, 450: 9, 500: 10, 550: 11 }),
    ...runnerFamily('r-pto', 'Push-to-open', 'Push-to-open runner', { 350: 10, 400: 10.5, 450: 11, 500: 12 }),
    ...runnerFamily('r-tri', 'Trimax (tandem box)', 'Trimax double-wall drawer system', { 400: 26, 450: 28, 500: 30 }, 'set'),
    ...runnerFamily('r-um', 'Soft-close undermount', 'Soft-close undermount runner', { 400: 20, 450: 22, 500: 24 }),
    ...runnerFamily('r-roller', 'Epoxy roller', 'Epoxy roller runner', { 350: 2.5, 450: 3 }),
    // handles
    acc({ id: 'hd-bar128', category: 'handle', style: 'bar', name: 'Bar handle stainless', size: '128mm', price: 2 }),
    acc({ id: 'hd-bar192', category: 'handle', style: 'bar', name: 'Bar handle stainless', size: '192mm', price: 2.8 }),
    acc({ id: 'hd-bar320', category: 'handle', style: 'bar', name: 'Bar handle matt black', size: '320mm', price: 5 }),
    acc({ id: 'hd-tbar', category: 'handle', style: 'tbar', name: 'T-bar handle', size: '160mm', price: 2.5 }),
    acc({ id: 'hd-knob', category: 'handle', style: 'knob', name: 'Round knob', size: '30mm', price: 1 }),
    acc({ id: 'hd-roman', category: 'handle', style: 'roman', name: 'Roman (classic bow) handle antique brass', size: '96mm', price: 3.5 }),
    acc({ id: 'hd-notch-round', category: 'handle', style: 'notchRound', name: 'Notched handle – round', size: 'machined cut-out', price: 1.5 }),
    acc({ id: 'hd-notch-oval', category: 'handle', style: 'notchOval', name: 'Notched handle – oval', size: 'machined cut-out', price: 1.5 }),
    acc({ id: 'hd-notch-trap', category: 'handle', style: 'notchTrapezium', name: 'Notched handle – trapezium', size: 'machined cut-out', price: 1.5 }),
    acc({ id: 'hd-finger', category: 'handle', style: 'finger', name: 'Finger pull profile', size: 'per metre', unit: 'm', price: 5 }),
    acc({ id: 'hd-gola', category: 'handle', style: 'profile', name: 'Gola / J-profile handle', size: 'per metre', unit: 'm', price: 6 }),
    acc({ id: 'hd-appliance', category: 'handle', style: 'appliance', name: 'Appliance pull handle', size: '450mm', price: 9 }),
    acc({ id: 'hd-push', category: 'handle', style: 'push', name: 'Push-to-open latch', size: 'handleless', price: 3 }),
    acc({ id: 'hd-push-mag', category: 'handle', style: 'push', name: 'Magnetic push-to-open system', size: 'handleless', price: 4.5 }),
    // sliding
    acc({ id: 'ro-std', category: 'roller', name: 'Sliding door roller set (top + bottom)', size: 'up to 40kg', unit: 'set', price: 15 }),
    acc({ id: 'ro-heavy', category: 'roller', name: 'Heavy duty sliding roller set', size: 'up to 80kg', unit: 'set', price: 28 }),
    acc({ id: 'ro-softclose', category: 'roller', name: 'Soft-close sliding roller set', size: 'up to 60kg', unit: 'set', price: 35 }),
    acc({ id: 'ro-mini', category: 'roller', name: 'Cabinet sliding door roller kit', size: 'small doors', unit: 'set', price: 6 }),
    acc({ id: 't-std', category: 'track', name: 'Sliding track top + bottom', size: 'double track', unit: 'm', price: 14 }),
    acc({ id: 't-heavy', category: 'track', name: 'Heavy duty sliding track set', size: 'double track', unit: 'm', price: 22 }),
    // pull-outs & organisers
    acc({ id: 'in-spice', category: 'insert', name: 'Spice rack pull-out', size: '150mm', minWidth: 140, price: 38 }),
    acc({ id: 'in-bin', category: 'insert', name: 'Trash bin pull-out (2 bins)', size: '400mm', minWidth: 380, price: 55 }),
    acc({ id: 'in-veg', category: 'insert', name: 'Vegetable basket rack', size: '3 tier', minWidth: 300, price: 42 }),
    acc({ id: 'in-pantry', category: 'insert', name: 'Pantry pull-out (tall larder)', size: '5 tier', minWidth: 300, price: 210 }),
    acc({ id: 'in-carousel', category: 'insert', name: 'Corner carousel / lazy susan', size: '3/4 round', minWidth: 750, price: 85 }),
    acc({ id: 'in-magic', category: 'insert', name: 'Magic corner pull-out', size: 'blind corner', minWidth: 450, price: 160 }),
    acc({ id: 'in-cutlery', category: 'insert', name: 'Cutlery tray insert', size: 'cut to fit', minWidth: 300, price: 12 }),
    acc({ id: 'in-bottle', category: 'insert', name: 'Bottle pull-out', size: '200mm', minWidth: 190, price: 34 }),
    // lighting
    acc({ id: 'lt-strip', category: 'lighting', lightKind: 'strip', name: 'LED strip', size: 'single colour, per metre', unit: 'm', price: 6 }),
    acc({ id: 'lt-strip-rgb', category: 'lighting', lightKind: 'strip', name: 'LED strip RGB', size: 'colour changing, per metre', unit: 'm', price: 9 }),
    acc({ id: 'lt-profile', category: 'lighting', lightKind: 'profile', name: 'Aluminium LED profile + diffuser', size: 'per metre', unit: 'm', price: 7 }),
    acc({ id: 'lt-spot', category: 'lighting', lightKind: 'spot', name: 'LED puck spotlight', size: '2W', price: 8 }),
    acc({ id: 'lt-bar', category: 'lighting', lightKind: 'bar', name: 'Under-cabinet LED light bar', size: 'per metre', unit: 'm', price: 18 }),
    acc({ id: 'lt-driver', category: 'lighting', lightKind: 'driver', name: 'LED driver / transformer 12V', size: '60W', price: 14 }),
    acc({ id: 'lt-sensor-door', category: 'lighting', lightKind: 'sensor', name: 'Door sensor switch', size: 'auto on/off', price: 7 }),
    acc({ id: 'lt-sensor-wave', category: 'lighting', lightKind: 'sensor', name: 'Hand-wave sensor switch', size: 'IR', price: 9 }),
    acc({ id: 'lt-sensor-touch', category: 'lighting', lightKind: 'sensor', name: 'Touch dimmer switch', size: 'dimmable', price: 10 }),
    acc({ id: 'lt-remote', category: 'lighting', lightKind: 'sensor', name: 'RGB remote controller', size: 'wireless', price: 12 }),
    // fixings & fittings
    acc({ id: 's-4x16', category: 'screw', name: 'Chipboard screws 4x16', size: 'box of 200', packQty: 200, price: 3 }),
    acc({ id: 's-4x35', category: 'screw', name: 'Chipboard screws 4x35', size: 'box of 200', packQty: 200, price: 4 }),
    acc({ id: 's-confirmat', category: 'screw', name: 'Confirmat screws 7x50', size: 'box of 100', packQty: 100, price: 6 }),
    acc({ id: 'cn-cam', category: 'connector', name: 'Cam lock & dowel set', size: '15mm', unit: 'set', price: 0.25 }),
    acc({ id: 'cn-dowel', category: 'connector', name: 'Wooden dowels 8x30', size: 'bag of 100', packQty: 100, price: 2 }),
    acc({ id: 'sp-std', category: 'shelfPin', name: 'Shelf support pins', size: '5mm', price: 0.05 }),
    acc({ id: 'l-adj100', category: 'leg', name: 'Adjustable plinth leg', size: '100-150mm', price: 1.5 }),
    acc({ id: 'l-chrome150', category: 'leg', name: 'Chrome furniture leg', size: '150mm', price: 4 }),
    acc({ id: 'l-hairpin', category: 'leg', name: 'Hairpin leg black', size: '200mm', price: 6 }),
    acc({ id: 'rl-oval', category: 'rail', name: 'Oval wardrobe rail chrome', size: '25mm', unit: 'm', price: 5 }),
    acc({ id: 'rl-pullout', category: 'rail', name: 'Pull-down wardrobe lift', size: '830-1150mm', price: 45 }),
    acc({ id: 'st-flap', category: 'stay', name: 'Lift-up flap stay', size: 'soft close', price: 8 }),
    acc({ id: 'st-gas', category: 'stay', name: 'Gas strut', size: '80N', price: 4 }),
    acc({ id: 'st-drop', category: 'stay', name: 'Drop-down flap stay', size: 'friction', price: 5 }),
    acc({ id: 'lk-cam', category: 'lock', name: 'Cupboard cam lock', size: '20mm', price: 3 }),
    acc({ id: 'fx-hanger', category: 'fixing', name: 'Wall cabinet hanger bracket', size: 'adjustable, pair', unit: 'pair', price: 3.5 }),
    acc({ id: 'fx-rail', category: 'fixing', name: 'Wall hanging rail', size: 'per metre', unit: 'm', price: 4 }),
    acc({ id: 'fx-bracket', category: 'fixing', name: 'Wall fixing bracket (built-in)', size: 'L-bracket', price: 0.6 }),
    acc({ id: 'fx-anchor', category: 'fixing', name: 'Wall anchor (8mm plug + screw)', size: 'pack of 100', packQty: 100, price: 9 }),
    acc({ id: 'fx-silicone', category: 'fixing', name: 'Silicone / construction adhesive 300ml', size: 'tube', price: 6 }),
    acc({ id: 'sv-cutout', category: 'service', name: 'Countertop cut-out (sink / hob)', size: 'per cut-out', price: 25 }),
    acc({ id: 'sv-notch', category: 'service', name: 'Handle notch machining', size: 'per door', price: 2 }),
    acc({ id: 'jn-dowel', category: 'fixing', name: 'Beech dowels 8x35 (panel joints)', size: 'pack of 100', packQty: 100, price: 4 }),
    acc({ id: 'jn-biscuit', category: 'fixing', name: 'Jointing biscuits No.20', size: 'pack of 100', packQty: 100, price: 6 }),
    acc({ id: 'jn-connector', category: 'fixing', name: 'Panel / worktop connector bolt', size: '150mm', price: 1.5 }),
    acc({ id: 'jn-domino', category: 'fixing', name: 'Domino tenons 8x40', size: 'pack of 50', packQty: 50, price: 12 }),
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
    showTradeMaterials: true,
    quotePrefix: 'QUO-',
    invoicePrefix: 'INV-',
    receiptPrefix: 'RCT-',
  },
  ai: { apiKey: '', model: 'claude-opus-5-5' },
  services: defaultServices(),
  ceilingRates: defaultCeilingRates(),
  ceilingDesigns: defaultCeilingDesigns(),
  ceilingExtras: defaultCeilingExtras(),
  tilingRates: defaultTilingRates(),
  tilingExtras: defaultTilingExtras(),
});

/** Starter list of services; prices are placeholders to edit in Settings › Material pricing hub › Services. */
export function defaultServices(): ServiceItem[] {
  const list: [string, string, string, number][] = [
    ['svc-measure', 'Site measure & consultation', 'visit', 30],
    ['svc-design', 'Design & 3D drawings', 'job', 50],
    ['svc-install', 'Installation', 'day', 80],
    ['svc-carpenter', 'Carpenter labour', 'hour', 10],
    ['svc-delivery', 'Delivery', 'trip', 40],
    ['svc-removal', 'Removal & disposal of old cabinets', 'job', 60],
    ['svc-plumbing', 'Plumbing connection (sink / dishwasher / washer)', 'point', 35],
    ['svc-electrical', 'Electrical connection (hob / oven / lights)', 'point', 35],
    ['svc-template', 'Worktop templating', 'job', 40],
    ['svc-wallprep', 'Wall preparation / patching', 'm²', 10],
    ['svc-painting', 'Painting', 'm²', 8],
    ['svc-repair', 'Repairs / adjustments', 'hour', 12],
  ];
  return list.map(([id, name, unit, price]) => ({ id, name, unit, price }));
}

/* Ceilings and tiling: prices are placeholders – set your own in Settings › Material pricing hub. */

export function defaultCeilingProducts(): CeilingProduct[] {
  return [
    { id: 'c-rhino-64-3000', kind: 'board', name: 'Rhinoboard 6.4mm 3000 × 1200', unit: 'sheet', price: 9.5, length: 3000, width: 1200, system: 'rhino' },
    { id: 'c-rhino-64-2700', kind: 'board', name: 'Rhinoboard 6.4mm 2700 × 1200', unit: 'sheet', price: 8.5, length: 2700, width: 1200, system: 'rhino' },
    { id: 'c-rhino-9-3000', kind: 'board', name: 'Rhinoboard 9mm 3000 × 1200', unit: 'sheet', price: 12, length: 3000, width: 1200, system: 'rhino' },
    { id: 'c-pvc-white', kind: 'pvc', name: 'PVC ceiling strip white 250mm × 6m', unit: 'strip', price: 6.5, length: 6000, width: 250, colour: '#f8fafc', system: 'pvc' },
    { id: 'c-pvc-wood', kind: 'pvc', name: 'PVC ceiling strip wood grain 250mm × 6m', unit: 'strip', price: 7.5, length: 6000, width: 250, colour: '#b88a5a', system: 'pvc' },
    { id: 'c-pvc-grey', kind: 'pvc', name: 'PVC ceiling strip grey 250mm × 6m', unit: 'strip', price: 7, length: 6000, width: 250, colour: '#9ca3af', system: 'pvc' },
    { id: 'c-pvc-gloss', kind: 'pvc', name: 'PVC ceiling strip white gloss 200mm × 5.95m', unit: 'strip', price: 7, length: 5950, width: 200, colour: '#ffffff', system: 'pvc' },
    { id: 'c-brand-38', kind: 'brandering', name: 'Brandering 38 × 38 pine 6.6m', unit: 'length', price: 5.5, length: 6600, system: 'both' },
    { id: 'c-brand-38-4', kind: 'brandering', name: 'Brandering 38 × 38 pine 4.2m', unit: 'length', price: 3.6, length: 4200, system: 'both' },
    { id: 'c-cornice-cove', kind: 'cornice', name: 'Cove cornice 75mm 3.66m', unit: 'length', price: 3.5, length: 3660, system: 'rhino' },
    { id: 'c-cornice-ornate', kind: 'cornice', name: 'Ornate cornice 110mm 3m', unit: 'length', price: 6, length: 3000, system: 'rhino' },
    { id: 'c-pvc-angle', kind: 'trim', name: 'PVC wall angle / cornice 6m', unit: 'length', price: 3, length: 6000, system: 'pvc' },
    { id: 'c-nails-75', kind: 'fixing', name: 'Wire nails 75mm (brandering) 1kg', unit: 'box', price: 3, coverage: 200, system: 'both' },
    { id: 'c-screws-25', kind: 'fixing', name: 'Drywall screws 25mm (box of 1000)', unit: 'box', price: 8, coverage: 1000, system: 'rhino' },
    { id: 'c-screws-pvc', kind: 'fixing', name: 'PVC ceiling screws / clips (box of 500)', unit: 'box', price: 5, coverage: 500, system: 'pvc' },
    { id: 'c-tape', kind: 'tape', name: 'Joint tape 90m', unit: 'roll', price: 4, coverage: 90, system: 'rhino' },
    { id: 'c-filler', kind: 'filler', name: 'Jointing / skim compound 20kg', unit: 'bag', price: 14, coverage: 40, system: 'rhino' },
    { id: 'c-cornice-adh', kind: 'adhesive', name: 'Cornice adhesive 5kg', unit: 'tub', price: 7, coverage: 30, system: 'rhino' },
    { id: 'c-paint-20', kind: 'paint', name: 'Ceiling paint white 20L', unit: 'tin', price: 45, coverage: 160, system: 'rhino' },
    { id: 'c-paint-5', kind: 'paint', name: 'Ceiling paint white 5L', unit: 'tin', price: 14, coverage: 40, system: 'rhino' },
    { id: 'c-insulation', kind: 'insulation', name: 'Ceiling insulation 135mm roll (10m²)', unit: 'roll', price: 28, coverage: 10, system: 'both' },
  ];
}

export const defaultCeilingRates = (): CeilingRates => ({ rhinoPerM2: 4.5, pvcPerM2: 4, cornicePerM: 1, paintPerM2: 1.5, insulationPerM2: 0.8, demolitionPerM2: 2, downlightEach: 3, markupPercent: 25, wastePercent: 10 });

export const defaultCeilingDesigns = (): PresetItem[] => [
  { id: 'cd-bulkhead', name: 'Bulkhead', unit: 'm', price: 18 },
  { id: 'cd-tray', name: 'Tray / coffered edge', unit: 'm', price: 22 },
  { id: 'cd-shadow', name: 'Shadow-line recess', unit: 'm', price: 9 },
  { id: 'cd-cove', name: 'LED cove with strip light', unit: 'm', price: 15 },
  { id: 'cd-twolevel', name: 'Two-level (drop) ceiling', unit: 'm²', price: 12 },
  { id: 'cd-hatch', name: 'Access hatch', unit: 'item', price: 15 },
  { id: 'cd-rose', name: 'Ceiling rose / medallion', unit: 'item', price: 10 },
];

export const defaultCeilingExtras = (): PresetItem[] => [
  { id: 'ce-pendant', name: 'Pendant light – supply & fit', unit: 'item', price: 35 },
  { id: 'ce-pendant-fit', name: 'Pendant light – fit only', unit: 'item', price: 10 },
  { id: 'ce-chandelier', name: 'Chandelier – install', unit: 'item', price: 40 },
  { id: 'ce-downlight', name: 'LED downlight – supply & fit', unit: 'item', price: 12 },
  { id: 'ce-fan', name: 'Ceiling fan – install', unit: 'item', price: 25 },
  { id: 'ce-transport', name: 'Transport', unit: 'trip', price: 30 },
  { id: 'ce-rubble', name: 'Rubble removal', unit: 'load', price: 25 },
  { id: 'ce-scaffold', name: 'Scaffolding / trestles hire', unit: 'day', price: 20 },
  { id: 'ce-repair', name: 'Roof leak / truss repair', unit: 'job', price: 40 },
];

export function defaultTiles(): TileProduct[] {
  return [
    { id: 't-por-600-grey', name: 'Porcelain 600 × 600 grey matt', type: 'porcelain', width: 600, height: 600, thickness: 9, perBox: 4, price: 22, colour: '#9ca3af', finish: 'matt' },
    { id: 't-por-600-white', name: 'Porcelain 600 × 600 white polished', type: 'porcelain', width: 600, height: 600, thickness: 9, perBox: 4, price: 24, colour: '#f5f5f4', finish: 'polished' },
    { id: 't-por-1200-marble', name: 'Porcelain 600 × 1200 marble look', type: 'porcelain', width: 600, height: 1200, thickness: 9, perBox: 2, price: 38, colour: '#e7e5e4', finish: 'polished' },
    { id: 't-plank-wood', name: 'Wood-look plank 200 × 1200', type: 'porcelain', width: 200, height: 1200, thickness: 9, perBox: 6, price: 30, colour: '#a16207', finish: 'textured' },
    { id: 't-cer-400-beige', name: 'Ceramic floor 400 × 400 beige', type: 'ceramic', width: 400, height: 400, thickness: 8, perBox: 9, price: 12, colour: '#d6c4a8', finish: 'matt' },
    { id: 't-cer-500-grey', name: 'Ceramic floor 500 × 500 grey', type: 'ceramic', width: 500, height: 500, thickness: 8, perBox: 6, price: 14, colour: '#a8a29e', finish: 'matt' },
    { id: 't-wall-300x600', name: 'Wall tile 300 × 600 white gloss', type: 'ceramic', width: 300, height: 600, thickness: 8, perBox: 8, price: 13, colour: '#fafaf9', finish: 'gloss' },
    { id: 't-wall-250x400', name: 'Wall tile 250 × 400 cream', type: 'ceramic', width: 250, height: 400, thickness: 7, perBox: 15, price: 11, colour: '#f3ead6', finish: 'gloss' },
    { id: 't-subway', name: 'Subway tile 75 × 150 white', type: 'ceramic', width: 75, height: 150, thickness: 7, perBox: 88, price: 14, colour: '#ffffff', finish: 'gloss' },
    { id: 't-mosaic', name: 'Mosaic sheet 300 × 300', type: 'mosaic', width: 300, height: 300, thickness: 6, perBox: 11, price: 25, colour: '#94a3b8', finish: 'gloss' },
  ];
}

export function defaultTileSupplies(): TileSupply[] {
  return [
    { id: 'ts-adh', kind: 'adhesive', name: 'Tile adhesive standard 20kg', unit: 'bag', price: 8, coverage: 20 },
    { id: 'ts-adh-flex', kind: 'adhesive', name: 'Flexible adhesive (porcelain / large tiles) 20kg', unit: 'bag', price: 12, coverage: 20 },
    { id: 'ts-grout-5', kind: 'grout', name: 'Grout 5kg', unit: 'bag', price: 7, coverage: 5 },
    { id: 'ts-grout-2', kind: 'grout', name: 'Grout 2kg', unit: 'bag', price: 3.5, coverage: 2 },
    { id: 'ts-spacer-2', kind: 'spacers', name: 'Tile spacers 2mm (250)', unit: 'pack', price: 1.5, coverage: 250 },
    { id: 'ts-spacer-3', kind: 'spacers', name: 'Tile spacers 3mm (250)', unit: 'pack', price: 1.5, coverage: 250 },
    { id: 'ts-level', kind: 'levelling', name: 'Tile levelling clips (100)', unit: 'pack', price: 6, coverage: 100 },
    { id: 'ts-trim-alu', kind: 'trim', name: 'Aluminium tile trim 2.5m', unit: 'length', price: 3, coverage: 2.5 },
    { id: 'ts-trim-pvc', kind: 'trim', name: 'PVC tile trim 2.5m', unit: 'length', price: 1.5, coverage: 2.5 },
    { id: 'ts-wp', kind: 'waterproofing', name: 'Waterproofing membrane 5L', unit: 'tub', price: 18, coverage: 4 },
    { id: 'ts-primer', kind: 'primer', name: 'Tile primer 5L', unit: 'tin', price: 10, coverage: 25 },
    { id: 'ts-silicone', kind: 'silicone', name: 'Sanitary silicone 280ml', unit: 'tube', price: 5, coverage: 8 },
    { id: 'ts-screed', kind: 'screed', name: 'Self-levelling compound 25kg', unit: 'bag', price: 14, coverage: 5 },
  ];
}

export const defaultTilingRates = (): TilingRates => ({
  floorPerM2: 6,
  wallPerM2: 7,
  skirtingPerM: 1.5,
  demolitionPerM2: 2.5,
  screedPerM2: 2,
  waterproofPerM2: 2,
  patternExtra: { straight: 0, brick: 5, diagonal: 15, herringbone: 30, chevron: 30 },
  largeFormatExtra: 15,
  markupPercent: 25,
});

export const defaultTilingExtras = (): PresetItem[] => [
  { id: 'te-transport', name: 'Transport', unit: 'trip', price: 30 },
  { id: 'te-rubble', name: 'Rubble removal', unit: 'load', price: 25 },
  { id: 'te-cutting', name: 'Special cuts / mitred edges', unit: 'm', price: 4 },
  { id: 'te-steps', name: 'Tiling steps (per step)', unit: 'step', price: 12 },
  { id: 'te-niche', name: 'Shower niche', unit: 'item', price: 35 },
  { id: 'te-sealing', name: 'Sealing natural stone', unit: 'm²', price: 3 },
];
