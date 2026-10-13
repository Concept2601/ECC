// Core data model for WoodQuote. All dimensions are millimetres, money is in the
// configured currency (stored as plain numbers).

export type ID = string;

/* ------------------------------------------------------------------ catalog */

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
}

export const ACCESSORY_CATEGORIES = [
  'hinge',
  'runner',
  'roller',
  'track',
  'handle',
  'screw',
  'connector',
  'shelfPin',
  'leg',
  'rail',
  'stay',
  'lock',
  'lighting',
  'other',
] as const;
export type AccessoryCategory = (typeof ACCESSORY_CATEGORIES)[number];

export const ACCESSORY_LABELS: Record<AccessoryCategory, string> = {
  hinge: 'Hinges',
  runner: 'Drawer runners',
  roller: 'Sliding rollers',
  track: 'Sliding tracks',
  handle: 'Handles',
  screw: 'Screws & nails',
  connector: 'Connectors / cam locks',
  shelfPin: 'Shelf pins',
  leg: 'Legs',
  rail: 'Hanging rails',
  stay: 'Flap stays / lifts',
  lock: 'Locks',
  lighting: 'Lighting',
  other: 'Other',
};

export type AccessoryUnit = 'pc' | 'pair' | 'set' | 'm';

export interface Accessory {
  id: ID;
  category: AccessoryCategory;
  name: string;
  size: string; // free text e.g. "35mm full overlay", "450mm"
  lengthMm?: number; // runners: nominal length; used for auto sizing
  family?: string; // runners of one family are auto-sized by length
  unit: AccessoryUnit;
  packQty: number; // e.g. screws sold per box of 200 (1 = sold individually)
  price: number; // price per pack (or per metre when unit = m)
}

export interface Catalog {
  boards: BoardMaterial[];
  edging: EdgeBanding[];
  glass: GlassType[];
  aluminium: AluminiumProfile[];
  countertops: Countertop[];
  accessories: Accessory[];
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

export type FrontKind = 'open' | 'door' | 'glassDoor' | 'drawer' | 'flap';

export interface Section {
  id: ID;
  size: number; // relative height weight
  front: FrontKind;
  doorCount: 1 | 2;
  drawerCount: number;
  shelves: number; // adjustable shelves inside
  hangingRail: boolean;
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

export interface Unit {
  id: ID;
  name: string;
  type: ProductType;
  qty: number;
  width: number;
  height: number;
  depth: number;
  base: 'none' | 'plinth' | 'legs';
  baseHeight: number;
  carcassMaterialId: ID;
  frontMaterialId: ID;
  backMaterialId: ID | null;
  edgingId: ID | null;
  frontEdgingId: ID | null;
  countertopId: ID | null;
  countertopOverhang: number; // extra depth at the front/back (islands use this for seating)
  glassId: ID | null;
  aluminiumId: ID | null;
  hingeId: ID | null;
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
  extraParts: ExtraPart[];
  extraHardware: ExtraHardware[];
  hardwareOverrides: Record<string, number>; // generated hardware key -> qty
  notes: string;
  labourOverride: number | null; // fixed labour price for this unit
}

/* ----------------------------------------------------------- generated data */

export interface Box3 {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
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

export interface UnitBuild {
  parts: Part[];
  hardware: HardwareLine[];
  aluminium: AluminiumLine[];
  rails: RailRender[];
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

export interface Quote {
  id: ID;
  number: string;
  title: string;
  date: string; // ISO date
  status: QuoteStatus;
  client: Client;
  units: Unit[];
  extras: ExtraLine[];
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
