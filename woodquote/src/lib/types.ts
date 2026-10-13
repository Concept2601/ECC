// Core data model for WoodQuote. All dimensions are millimetres, money is in the
// configured currency (stored as plain numbers).

export type ID = string;

/* ------------------------------------------------------------------ catalog */

export type SurfaceFinish = 'matte' | 'satin' | 'gloss' | 'textured';

export interface BoardMaterial {
  id: ID;
  name: string;
  category: string; // MDF, Melamine, Plywood, HMR, Hardboard, Solid wood ...
  thickness: number;
  sheetLength: number; // along grain
  sheetWidth: number;
  pricePerSheet: number;
  color: string; // hex used by the renderer
  grain: boolean; // true = parts may not be rotated on the sheet
  texture: 'plain' | 'wood';
  finish: SurfaceFinish; // drives how light reflects in the render
}

export interface EdgeBanding {
  id: ID;
  name: string;
  pricePerMeter: number;
  color: string;
}

export interface GlassType {
  id: ID;
  name: string;
  thickness: number;
  pricePerSqm: number;
  color: string;
  opacity: number;
}

export interface AluminiumProfile {
  id: ID;
  name: string;
  stockLength: number; // mm, e.g. 6000
  pricePerLength: number;
  color: string;
}

export interface Countertop {
  id: ID;
  name: string;
  thickness: number;
  pricePerSqm: number;
  color: string;
  finish: SurfaceFinish;
}

export const ACCESSORY_CATEGORIES = [
  'hinge',
  'runner',
  'handle',
  'roller',
  'track',
  'insert',
  'lighting',
  'screw',
  'connector',
  'shelfPin',
  'leg',
  'rail',
  'stay',
  'lock',
  'fixing',
  'service',
  'other',
] as const;
export type AccessoryCategory = (typeof ACCESSORY_CATEGORIES)[number];

export const ACCESSORY_LABELS: Record<AccessoryCategory, string> = {
  hinge: 'Hinges',
  runner: 'Drawer runners',
  handle: 'Handles & push systems',
  roller: 'Sliding rollers',
  track: 'Sliding tracks',
  insert: 'Pull-outs & organisers',
  lighting: 'Lighting',
  screw: 'Screws & nails',
  connector: 'Connectors / cam locks',
  shelfPin: 'Shelf pins',
  leg: 'Legs',
  rail: 'Hanging rails',
  stay: 'Flap stays / lifts',
  lock: 'Locks',
  fixing: 'Wall fixings & fillers',
  service: 'Machining & services',
  other: 'Other',
};

export type AccessoryUnit = 'pc' | 'pair' | 'set' | 'm';

export type HandleStyle =
  | 'bar'
  | 'tbar'
  | 'knob'
  | 'roman'
  | 'notchRound'
  | 'notchOval'
  | 'notchTrapezium'
  | 'finger'
  | 'appliance'
  | 'profile'
  | 'push';

export type DoorFit = 'overlay' | 'half' | 'inset';

export type LightKind = 'strip' | 'profile' | 'spot' | 'bar' | 'driver' | 'sensor';

export interface Accessory {
  id: ID;
  category: AccessoryCategory;
  name: string;
  size: string; // free text e.g. "35mm full overlay", "450mm"
  lengthMm?: number; // runners: nominal length; used for auto sizing
  family?: string; // runners / hinges of one family are auto-sized / auto-fitted
  fit?: DoorFit; // hinges: overlay type
  style?: HandleStyle; // handles: drives the 3D render
  lightKind?: LightKind; // lighting
  minWidth?: number; // inserts: smallest compartment width they fit
  unit: AccessoryUnit;
  packQty: number; // e.g. screws sold per box of 200 (1 = sold individually)
  price: number; // price per pack (or per metre when unit = m)
}

export const APPLIANCE_CATEGORIES = ['hob', 'oven', 'microwave', 'fridge', 'dishwasher', 'hood', 'sink', 'washer', 'wineCooler', 'cooker', 'other'] as const;
export type ApplianceCategory = (typeof APPLIANCE_CATEGORIES)[number];

export const APPLIANCE_LABELS: Record<ApplianceCategory, string> = {
  hob: 'Hobs',
  oven: 'Ovens',
  microwave: 'Microwaves',
  fridge: 'Refrigerators',
  dishwasher: 'Dishwashers',
  hood: 'Extractor hoods',
  sink: 'Sinks',
  washer: 'Washing machines',
  wineCooler: 'Wine coolers',
  cooker: 'Freestanding stoves',
  other: 'Other appliances',
};

export interface Appliance {
  id: ID;
  category: ApplianceCategory;
  name: string;
  variant: string; // gas, electric, induction, side-by-side, double bowl ...
  width: number;
  height: number;
  depth: number;
  price: number;
  color: string;
  /** where it lives: on top of a counter, inside a compartment, or free standing */
  placement: 'top' | 'inbuilt' | 'freestanding';
}

export interface Catalog {
  boards: BoardMaterial[];
  edging: EdgeBanding[];
  glass: GlassType[];
  aluminium: AluminiumProfile[];
  countertops: Countertop[];
  accessories: Accessory[];
  appliances: Appliance[];
}

/* ----------------------------------------------------------------- settings */

export interface TransportOption {
  id: ID;
  name: string;
  price: number;
}

export interface PricingSettings {
  currency: string;
  taxRate: number; // %
  taxLabel: string;
  markupPercent: number;
  labourMode: 'percent' | 'perUnit';
  labourPercent: number; // % of materials
  labourPerUnit: number;
  installationPercent: number; // % of materials when installation is requested
  kerf: number; // saw blade width
  sheetTrim: number; // trimmed off each sheet edge
  minOffcut: number; // offcuts smaller than this (either side) are waste
  boardCharging: 'fullSheets' | 'usedArea';
  cutMode: 'guillotine' | 'nested';
  edgingWastePercent: number;
  screwsPerJoint: number;
  transportOptions: TransportOption[];
}

export interface CompanyProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  logo: string | null; // data URL
}

export interface DocTemplate {
  accentColor: string;
  logoPosition: 'left' | 'center' | 'right';
  headerText: string; // extra free text under the company block
  headerFields: { label: string; value: string }[];
  footerText: string;
  showPageNumbers: boolean;
  bankDetails: string;
  quoteTitle: string;
  invoiceTitle: string;
  receiptTitle: string;
  quoteTerms: string;
  invoiceTerms: string;
  receiptNote: string;
  quoteValidityDays: number;
  showRenders: boolean;
  showElevations: boolean;
  quoteDetail: 'units' | 'itemised';
  signatureLine: boolean;
  quotePrefix: string;
  invoicePrefix: string;
  receiptPrefix: string;
}

export interface AISettings {
  apiKey: string;
  model: string;
}

export interface Settings {
  company: CompanyProfile;
  pricing: PricingSettings;
  doc: DocTemplate;
  ai: AISettings;
}

/* -------------------------------------------------------------------- units */

export type ProductType =
  | 'tv_stand'
  | 'kitchen_base'
  | 'kitchen_wall'
  | 'kitchen_tall'
  | 'island'
  | 'built_in'
  | 'wardrobe'
  | 'sliding_wardrobe'
  | 'bookshelf'
  | 'vanity'
  | 'custom';

export type FrontKind = 'open' | 'door' | 'drawer' | 'sliding' | 'appliance';
export type DoorMaterial = 'wood' | 'glass' | 'frameless';
/** left / right = hinge side, pair = two doors, up = lift-up flap (top hinged), down = drop-down flap */
export type Opening = 'left' | 'right' | 'pair' | 'up' | 'down';
/** single sliding panel that opens to the left or right, or two by-passing panels */
export type SlideDir = 'left' | 'right' | 'bypass';

export interface Section {
  id: ID;
  size: number; // relative height weight
  front: FrontKind;
  doorMaterial: DoorMaterial;
  fit: DoorFit;
  opening: Opening;
  slide: SlideDir;
  drawerCount: number;
  shelves: number; // adjustable shelves inside
  hangingRail: boolean;
  applianceId: ID | null; // front = appliance (oven, microwave, fridge ...)
  insertId: ID | null; // pull-out organiser (spice rack, bin, baskets, pantry)
}

export interface Bay {
  id: ID;
  size: number; // relative width weight
  sections: Section[]; // bottom -> top
}

export interface SlidingDoors {
  enabled: boolean;
  panels: number;
  style: 'board' | 'glass' | 'mirror';
}

export interface ExtraPart {
  id: ID;
  name: string;
  materialId: ID;
  length: number;
  width: number;
  qty: number;
  edgeLength: number; // metres of edge banding per piece
}

export interface ExtraHardware {
  id: ID;
  accessoryId: ID;
  qty: number;
}

export interface Sides<T> {
  front: T;
  back: T;
  left: T;
  right: T;
}

export type PanelStyle = 'flat' | 'shaker' | 'fluted' | 'slatted';

/** Exposed decorative board fitted on the outside of the carcass. */
export interface FinishPanel {
  enabled: boolean;
  materialId: ID;
  style: PanelStyle;
  toFloor: boolean; // run down past the plinth / legs to the floor
}

export type LightLocation = 'underCabinet' | 'insideTop' | 'shelves' | 'plinth' | 'top' | 'backPanel';

export interface Light {
  id: ID;
  accessoryId: ID; // strip / profile / spot / light bar
  location: LightLocation;
  temperature: number; // Kelvin; 0 = RGB colour
  color: string; // used when temperature = 0
  bays: number[]; // empty = every bay
  sensorId: ID | null; // door sensor / hand-wave / touch switch
}

export interface TopAppliance {
  id: ID;
  applianceId: ID; // hob or sink set into the top
  bay: number;
}

export interface Unit {
  id: ID;
  name: string;
  type: ProductType;
  qty: number;
  width: number;
  height: number;
  depth: number;
  installType: 'builtIn' | 'standalone';
  mount: 'floor' | 'wall';
  mountHeight: number; // bottom of a wall-hung unit above the floor
  base: 'none' | 'plinth' | 'legs'; // none = carcass sits straight on the floor
  baseHeight: number;
  plinthSides: Sides<boolean>; // which faces get a kick board
  plinthRecess: number; // how far the kick board is set back
  carcassMaterialId: ID;
  frontMaterialId: ID;
  backMaterialId: ID | null;
  edgingId: ID | null;
  frontEdgingId: ID | null;
  countertopId: ID | null;
  topBoardId: ID | null; // solid board top (when there is no countertop)
  overhang: Sides<number>; // countertop / board top overhang per side
  finishPanels: { left: FinishPanel; right: FinishPanel; back: FinishPanel };
  glassId: ID | null;
  aluminiumId: ID | null;
  hingeId: ID | null;
  glassHingeId: ID | null;
  runnerId: ID | null;
  handleId: ID | null;
  legId: ID | null;
  rollerId: ID | null;
  trackId: ID | null;
  screwId: ID | null;
  connectorId: ID | null;
  shelfPinId: ID | null;
  railId: ID | null;
  stayId: ID | null;
  sliding: SlidingDoors;
  bays: Bay[];
  lights: Light[];
  topAppliances: TopAppliance[];
  extraParts: ExtraPart[];
  extraHardware: ExtraHardware[];
  hardwareOverrides: Record<string, number>; // generated hardware key -> qty
  notes: string;
  labourOverride: number | null; // fixed labour price for this unit
}

/* --------------------------------------------------------- kitchen runs */

export type RunShape = 'straight' | 'L' | 'U';

/** One slot along a wall: floor unit (+ optional wall unit above), a tall unit, or a gap. */
export interface RunModule {
  id: ID;
  kind: 'base' | 'tall' | 'gap';
  width: number;
  base: Unit | null; // base or tall unit
  wall: Unit | null; // hanging unit above a base unit
  hoodId: ID | null; // chimney hood above (instead of / under the wall unit)
  gapApplianceId: ID | null; // free standing fridge / stove in a gap
  gapLabel: string;
}

export interface Run {
  id: ID;
  name: string;
  qty: number;
  shape: RunShape;
  legs: RunModule[][]; // [back wall, right wall, left wall]
  counterHeight: number; // floor to top of worktop
  baseDepth: number;
  plinthHeight: number;
  wallBottom: number; // underside of wall units above floor
  wallHeight: number;
  wallDepth: number;
  tallHeight: number;
  countertopId: ID | null;
  counterOverhang: number; // front overhang of the worktop
  installType: 'builtIn' | 'standalone';
  notes: string;
}

/* ----------------------------------------------------------- generated data */

export interface SectionRef {
  bay: number;
  section: number;
}

export interface BoxMeta {
  ref?: SectionRef; // which compartment this belongs to (for click-to-edit)
  door?: string; // groups a door's panel, glass, frame & handle
  hinge?: 'left' | 'right' | 'top' | 'bottom'; // pivot side when doors are opened
  slide?: 'left' | 'right';
  drawer?: boolean;
  handle?: boolean; // attach a handle to this front
  style?: PanelStyle;
}

export interface Box3 {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  meta?: BoxMeta;
}

export type PartRole =
  | 'carcass'
  | 'back'
  | 'shelf'
  | 'door'
  | 'drawerFront'
  | 'drawerBox'
  | 'plinth'
  | 'glass'
  | 'aluminium'
  | 'counter'
  | 'finish'
  | 'extra';

export interface Part {
  key: string;
  name: string;
  role: PartRole;
  kind: 'board' | 'glass' | 'counter';
  materialId: ID | null;
  length: number;
  width: number;
  thickness: number;
  qty: number;
  edgeLength: number; // metres of edge banding per piece
  edgingId: ID | null;
  boxes: Box3[]; // 3D placement for each piece (may be empty for hidden parts)
}

export interface HardwareLine {
  key: string;
  accessoryId: ID;
  qty: number; // in accessory units (pcs/pairs/sets/metres)
  reason: string;
}

export interface AluminiumLine {
  profileId: ID;
  pieces: number[]; // individual cut lengths in mm
  boxes: Box3[];
}

export interface RailRender {
  box: Box3;
}

export interface LightRender {
  box: Box3; // the visible strip / spot
  color: string;
  dir: 'down' | 'up' | 'front';
}

export interface ApplianceRender {
  applianceId: ID;
  box: Box3;
  ref?: SectionRef;
}

export interface InsertRender {
  accessoryId: ID;
  box: Box3;
  ref?: SectionRef;
}

export interface UnitBuild {
  parts: Part[];
  hardware: HardwareLine[];
  aluminium: AluminiumLine[];
  rails: RailRender[];
  lights: LightRender[];
  appliances: ApplianceRender[];
  inserts: InsertRender[];
  applianceList: { applianceId: ID; qty: number }[];
  warnings: string[];
}

/* ------------------------------------------------------------------- quotes */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'invoiced';

export interface Client {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface ExtraLine {
  id: ID;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Attachment {
  id: ID;
  name: string;
  dataUrl: string; // image (jpeg / png)
  caption: string;
  includeInPdf: boolean;
}

export interface Quote {
  id: ID;
  number: string;
  title: string;
  date: string; // ISO date
  status: QuoteStatus;
  client: Client;
  units: Unit[];
  runs: Run[];
  extras: ExtraLine[];
  attachments: Attachment[];
  includeAppliances: boolean; // appliances supplied by us (priced) or by the client
  transportId: ID | null;
  transportCustom: number; // added on top (e.g. distance surcharge)
  installation: boolean;
  markupPercent: number;
  discountType: 'percent' | 'amount';
  discountValue: number;
  applyTax: boolean;
  notes: string;
  sourceImage: string | null; // diagram used by the reader
  createdAt: number;
  updatedAt: number;
}

/* ----------------------------------------------------- invoices / receipts */

export interface InvoiceLine {
  id: ID;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Payment {
  id: ID;
  date: string;
  amount: number;
  method: string;
  reference: string;
  receiptNumber: string;
}

export interface Invoice {
  id: ID;
  number: string;
  quoteId: ID | null;
  quoteNumber: string;
  date: string;
  dueDate: string;
  client: Client;
  lines: InvoiceLine[];
  discountType: 'percent' | 'amount';
  discountValue: number;
  applyTax: boolean;
  depositType: 'percent' | 'amount';
  depositValue: number;
  payments: Payment[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Counters {
  quote: number;
  invoice: number;
  receipt: number;
}
