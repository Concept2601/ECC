// Core data model for En-Quote. All dimensions are millimetres, money is in the
// configured currency (stored as plain numbers).

export type ID = string;

/* ------------------------------------------------------------------ catalog */

export type SurfaceFinish = 'matte' | 'satin' | 'gloss' | 'textured' | 'metallic';

/**
 * A finish colour / texture from the finish library, e.g. "High gloss red" or
 * "Oak natural (photo texture)". It sets how a board looks (in 3D, renders and
 * drawings); the board itself still sets the price, plus an optional surcharge
 * per m² for the finishing work (spray painting, veneering, wrapping).
 */
export interface Finish {
  id: ID;
  name: string;
  /** main colour (also used in 2D drawings and when there is no texture) */
  color: string;
  finish: SurfaceFinish;
  /** id of the texture image in the finishes store (PNG / JPG), null = plain colour */
  textureId: string | null;
  /** small preview image (data URL) for lists */
  thumb?: string | null;
  /** real-world size the texture image covers (mm) */
  textureSize: number;
  /** grain / pattern direction: along each panel's length, or always vertical */
  grain: 'length' | 'vertical';
  /** extra price per m² of finished area (0 = included in the board price) */
  surcharge: number;
  category: string;
  /** board colours & textures database */
  supplier?: string;
  range?: string;
  /** solid colour, woodgrain, stone / concrete or other pattern (woodgrains get a grain look until you add a photo) */
  kind?: 'solid' | 'woodgrain' | 'stone' | 'other';
  /** board types this colour is available on; empty = any board */
  boardIds?: ID[];
}

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
  /** look from the finish library (colour / photo texture); overrides colour + texture above */
  finishId?: ID | null;
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
  /** look from the finish library (e.g. a granite or marble photo) */
  finishId?: ID | null;
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

export const APPLIANCE_CATEGORIES = ['cooker', 'hob', 'downdraft', 'oven', 'microwave', 'fridge', 'dishwasher', 'washer', 'hood', 'sink', 'wineCooler', 'other'] as const;
export type ApplianceCategory = (typeof APPLIANCE_CATEGORIES)[number];

export const APPLIANCE_LABELS: Record<ApplianceCategory, string> = {
  hob: 'Stove hobs',
  downdraft: 'Downdraft extractors',
  oven: 'Ovens',
  microwave: 'Microwaves',
  fridge: 'Refrigerators',
  dishwasher: 'Dishwashers',
  hood: 'Extractor hoods',
  sink: 'Sinks',
  washer: 'Washing machines',
  wineCooler: 'Wine coolers',
  cooker: 'Stoves (free-standing)',
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
  plates?: number; // hobs: number of plates / burners
  /** sinks: bowls and drainers, material and mounting (missing = worked out from the name) */
  sink?: SinkSpec;
}

/**
 * A sink's layout from left to right: B = bowl, H = half bowl, D = drainer.
 * e.g. "BD" bowl + drainer, "DBD" two drainers with a bowl, "BB" double bowl, "BHD" 1.5 bowl + drainer.
 */
export interface SinkSpec {
  layout: string;
  material: 'stainless' | 'granite' | 'ceramic';
  color: string;
  mount: 'inset' | 'undermount';
  tap: 'centre' | 'left' | 'right' | 'none';
}

export interface Catalog {
  boards: BoardMaterial[];
  edging: EdgeBanding[];
  glass: GlassType[];
  aluminium: AluminiumProfile[];
  countertops: Countertop[];
  accessories: Accessory[];
  appliances: Appliance[];
  /**
   * Ids of the built-in library items this device has already been given. Only
   * built-in items that are not listed here are added on start-up, so items you
   * delete stay deleted and your prices are never replaced.
   */
  defaultsSeen?: string[];
  /** finish colours and textures (gloss, matt, wood, marble…) */
  finishes?: Finish[];
  /** ceilings: boards, PVC strips, brandering, cornices, trims, fixings, jointing, paint… */
  ceilingProducts?: CeilingProduct[];
  /** tiling: tiles (size, type, colour, per box) */
  tiles?: TileProduct[];
  /** tiling: adhesive, grout, spacers, trims, waterproofing… */
  tileSupplies?: TileSupply[];
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
  /** list the materials (boxes, bags, lengths…) of ceilings and tiling on the quotation */
  showTradeMaterials?: boolean;
  quotePrefix: string;
  invoicePrefix: string;
  receiptPrefix: string;
}

export interface AISettings {
  apiKey: string;
  model: string;
  /** Plan reader: which AI service reads plans automatically. */
  provider?: 'anthropic' | 'openai';
  openaiKey?: string;
  openaiModel?: string;
}

export interface Settings {
  company: CompanyProfile;
  pricing: PricingSettings;
  doc: DocTemplate;
  ai: AISettings;
  /** saved services and other non-design items with their usual price */
  services?: ServiceItem[];
  ceilingRates?: CeilingRates;
  ceilingDesigns?: PresetItem[];
  ceilingExtras?: PresetItem[];
  tilingRates?: TilingRates;
  tilingExtras?: PresetItem[];
}

/** A service or other non-design item you charge for (installation, delivery, site measure…). */
export interface ServiceItem {
  id: ID;
  name: string;
  /** what one is: day, hour, trip, visit, point, m², job… */
  unit: string;
  price: number;
}

/* -------------------------------------------------------------------- units */

export type ProductType =
  | 'tv_stand'
  | 'tv_base'
  | 'kitchen_base'
  | 'kitchen_wall'
  | 'kitchen_tall'
  | 'island'
  | 'built_in'
  | 'wardrobe'
  | 'sliding_wardrobe'
  | 'bookshelf'
  | 'vanity'
  | 'corner_base'
  | 'corner_wall'
  | 'custom';

/** Corner cupboard: Width A (unit.width) along one wall, Width B along the other. */
export interface CornerSpec {
  widthB: number;
  /**
   * L = two doors meeting in the corner, panels in two pieces;
   * square = the same shape with one solid L-shaped top, bottom and shelves;
   * diagonal = one angled front across the corner;
   * blind = a straight cabinet on the main wall with a blind panel at the corner and a
   * reach-in door; its worktop carries on round the corner as a joined remainder (Width B).
   */
  style: 'L' | 'square' | 'diagonal' | 'blind';
  /** which side the return (Width B) goes: right = along the right-hand wall */
  hand: 'left' | 'right';
  shelves: number;
  carousel: boolean;
  /** door material, like any other door: wood, aluminium-framed glass or frameless glass */
  doorMaterial?: DoorMaterial;
  /** doors on the main wall / side wall (L) or across the corner (diagonal); null = automatic (max 600mm each) */
  doorsA?: number | null;
  doorsB?: number | null;
  /** open corner: no doors at all */
  open?: boolean;
}

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
  /** hanging rails in this compartment (with hangingRail): the height is shared equally, one rail under each shelf */
  railCount?: number;
  /** move each rail up (+) or down (−) in mm, top rail first */
  railOffsets?: number[];
  /** drawers without fronts inside a door / sliding-door compartment (stacked from the bottom) */
  innerDrawers?: number;
  /** how the inner drawers open: push-to-open runners or a notch cut in the drawer's front edge */
  innerPull?: 'push' | 'notch';
  /** appliance compartment: cover it with a matching door panel (fridges are open by default) */
  applianceDoor?: boolean;
  /** divide just this compartment: side by side (cols) or one above another (rows) */
  split?: { dir: 'cols' | 'rows'; parts: Section[] } | null;
  /** size typed or dragged by hand: kept when neighbours are split or added */
  custom?: boolean;
}

export interface Bay {
  id: ID;
  size: number; // relative width weight
  sections: Section[]; // bottom -> top
  /** width typed or dragged by hand: kept when bays are added */
  custom?: boolean;
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
  /** @deprecated kept in old saves; panels now run to the floor unless `short` */
  toFloor: boolean;
  /** stop at the plinth / legs instead of running down to the floor */
  short?: boolean;
  /** use materialId instead of following the fronts board */
  ownMaterial?: boolean;
  slatWidth?: number; // slatted: width of each slat (mm), default 40
  slatGap?: number; // slatted: gap between slats (mm), default 15
}

export type LightLocation = 'underCabinet' | 'insideTop' | 'shelves' | 'plinth' | 'top' | 'backPanel' | 'custom';

/** A light placed anywhere, in unit coordinates (mm from the unit's left, floor/bottom and back). */
export interface CustomLightPos {
  x: number;
  y: number;
  z: number;
  length: number;
  vertical: boolean;
  dir: 'down' | 'up' | 'front';
}

export interface Light {
  id: ID;
  accessoryId: ID; // strip / profile / spot / light bar
  location: LightLocation;
  temperature: number; // Kelvin; 0 = RGB colour
  color: string; // used when temperature = 0
  bays: number[]; // empty = every bay
  sensorId: ID | null; // door sensor / hand-wave / touch switch
  custom?: CustomLightPos; // used when location = custom
}

export interface TopAppliance {
  id: ID;
  applianceId: ID; // hob or sink set into the top
  bay: number;
  frontGap?: number | null; // mm from the worktop front edge to the front of the hob / sink (blank = centred)
  xOffset?: number | null; // mm from the unit's left edge to the hob's left edge (blank = centred over the bay)
  downdraftId?: ID | null; // downdraft extractor fitted behind the hob
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
  /** leave out carcass parts, e.g. a TV base between tall side cabinets: no sides, no top */
  noSides?: boolean;
  noTop?: boolean;
  noBack?: boolean;
  baseHeight: number;
  plinthSides: Sides<boolean>; // which faces get a kick board
  plinthRecess: number; // how far the kick board is set back
  carcassMaterialId: ID;
  frontMaterialId: ID;
  /** finish colour / texture of doors, drawer fronts and visible panels (null = the board's own look) */
  frontFinishId?: ID | null;
  /** finish colour / texture of the carcass, shelves and backs */
  carcassFinishId?: ID | null;
  backMaterialId: ID | null;
  edgingId: ID | null;
  frontEdgingId: ID | null;
  countertopId: ID | null;
  topBoardId: ID | null; // solid board top (when there is no countertop)
  overhang: Sides<number>; // countertop / board top overhang per side
  finishPanels: { left: FinishPanel; right: FinishPanel; back: FinishPanel };
  corner?: CornerSpec | null;
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
  kind: 'base' | 'tall' | 'gap' | 'filler';
  width: number;
  /** Custom sizes for this position only (null / missing = the kitchen's sizes). */
  height?: number | null; // base / tall cabinet height, space or filler height
  depth?: number | null; // base / tall cabinet depth
  wallHeight?: number | null; // wall cabinet above
  wallBottom?: number | null;
  wallDepth?: number | null;
  /** corner cupboard: length along the next wall (Width B) */
  cornerB?: number | null;
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
  /** Measured wall / space length for each leg (mm); the designer shows what is left to fill. */
  targets?: (number | null)[];
  /** Which wall's cabinets run into each corner: the back wall (default) or the side wall. */
  corners?: { right?: 'back' | 'side'; left?: 'back' | 'side' };
  counterHeight: number; // floor to top of worktop
  splash?: SplashSpec | null;
  topFill?: TopFillSpec | null;
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
  path?: number[]; // index into nested splits of the compartment
}

export interface BoxMeta {
  ref?: SectionRef; // which compartment this belongs to (for click-to-edit)
  door?: string; // groups a door's panel, glass, frame & handle
  /** inner drawer (no fascia) behind a door */
  inner?: boolean;
  /** inner drawer front with a pull notch cut in its top edge */
  notch?: boolean;
  hinge?: 'left' | 'right' | 'top' | 'bottom'; // pivot side when doors are opened
  slide?: 'left' | 'right';
  drawer?: boolean;
  handle?: boolean; // attach a handle to this front
  style?: PanelStyle;
  slatWidth?: number;
  slatGap?: number;
  /** drawn in its own frame: moved to (x, z) and turned rot degrees about the vertical (corner cupboards) */
  frame?: { x: number; z: number; rot: number };
  /** panel outline (x, z) instead of a rectangle, e.g. diagonal corner shelves */
  shape?: [number, number][];
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
  /** unit shown next to the quantity (day, trip, m²…) */
  unit?: string;
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
  /** Cabinet groups: islands, peninsulas, free-standing groups and loose appliances, each piece facing any way. */
  assemblies?: Assembly[];
  /** Ceilings section (rhinoboard / PVC) */
  ceilings?: CeilingJob;
  /** Tiling section */
  tiling?: TilingJob;
  /** which trade the quotation was started in (decides what opens first) */
  trade?: Trade;
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
  room: Room | null; // room layout for visualising the design
  createdAt: number;
  updatedAt: number;
}

/* ---------------------------------------------------- cabinet groups */

/** One cabinet (or free-standing appliance) in a group, placed on the group's plan. */
export interface AssemblyPiece {
  id: ID;
  unit: Unit | null;
  applianceId?: ID | null;
  /** back-left corner on the plan (mm) and which way it faces, like room placements:
      0 = front faces the front, 180 = faces the back, 90 = faces left, 270 = faces right */
  x: number;
  z: number;
  rot: number;
  /** sits under the shared worktop (height set by the group) */
  underTop: boolean;
  /** cabinet rows: space left before this piece (mm) */
  gapBefore?: number;
  /** wall slats fixed straight onto the wall (instead of a cabinet or appliance) */
  slats?: SlatWall | null;
  /** own size for this appliance (not for standard-size fridges, stoves, hobs, ovens, microwaves) */
  size?: { width: number; height: number; depth: number } | null;
}

/** Slatted wall panelling glued (silicone) and anchored straight onto the wall. */
export interface SlatWall {
  width: number;
  height: number;
  /** bottom of the slats above the floor */
  bottom: number;
  slatWidth: number;
  slatGap: number;
  materialId: ID;
  /** optional backing board behind the slats (e.g. black MDF), null = slats straight on the wall */
  backerId: ID | null;
  /** slats, or one solid wall panel / backsplash (stone, tiles or a board), e.g. behind a TV */
  style?: 'slats' | 'panel';
  /** panel: worktop / stone / tile material (priced per m²) or a board */
  panelSource?: 'counter' | 'board';
  panelId?: ID | null;
}

/** Kitchen backsplash between the worktop and the wall units, along every worktop. */
export interface SplashSpec {
  source: 'counter' | 'board';
  materialId: ID;
  /** null = up to the underside of the wall units */
  height: number | null;
}

/** Optional panels (or slats) above wall and tall units, up to the ceiling. */
export interface TopFillSpec {
  ceiling: number;
  materialId: ID | null; // null = fronts board
  style: 'flat' | 'slatted';
}

export interface Assembly {
  id: ID;
  name: string;
  qty: number;
  pieces: AssemblyPiece[];
  top: { countertopId: ID | null; height: number; overhang: Sides<number> };
  /**
   * free = every piece placed by hand; row = cabinets side by side along a wall in
   * list order, like a kitchen run (wall-hung pieces go above the floor cabinet before them)
   */
  layout?: 'free' | 'row';
  /** exposed finish boards, each one piece across the whole group (e.g. island ends and backs) */
  panels?: Sides<boolean> & { materialId: ID | null };
  notes: string;
}

/* -------------------------------------------------------------- rooms */

export type WallSide = number; // index into Room.walls

/** One straight wall. Walls are drawn one after another, each starting where the previous one ended. */
export interface RoomWall {
  id: ID;
  length: number;
  angle: number; // direction in degrees on the plan: 0 = right, 90 = towards the front, 180 = left, 270 = towards the back
  height: number;
  visible: boolean; // hidden walls are cut away in 3D so the client can see in
}

export interface RoomOpening {
  id: ID;
  kind: 'window' | 'door' | 'opening';
  wall: WallSide;
  offset: number; // mm from the start of the wall
  width: number;
  height: number; // top of the opening above the floor
  sill: number; // windows: bottom above the floor
  beam: boolean; // RC beam over an open-plan opening
  beamDepth: number; // how far the beam drops below the ceiling
  label: string;
  /** doors: wooden swing door (single / double leaf) or aluminium & glass sliding door */
  doorStyle?: 'swing' | 'double' | 'sliding';
  /** swing doors: which side the hinges are on, seen from inside the room */
  hinge?: 'left' | 'right';
  /** swing doors: open into the room or outwards */
  swing?: 'in' | 'out';
  /** sliding doors: number of panels (null = automatic) */
  panels?: number | null;
  /** windows: number of panes (null = automatic: 600mm panes, none narrower than 500mm) */
  panes?: number | null;
}

export interface RoomPlacement {
  itemId: ID; // unit or kitchen run id
  x: number; // position of the item's back-left corner
  z: number;
  rot: number; // degrees
}

/** Something read from a plan (or drawn in): a built-in cupboard, kitchen run, island, sink… */
export type FixtureKind = 'bic' | 'baseRun' | 'wallRun' | 'tall' | 'island' | 'sink' | 'stove' | 'hob' | 'fridge' | 'other';
export interface RoomFixture {
  id: ID;
  kind: FixtureKind;
  label: string;
  x: number; // back-left corner on the plan (mm)
  z: number;
  w: number; // along its back
  d: number; // depth out from its back
  rot: number; // degrees, same convention as placements
  height?: number | null;
}

export interface Room {
  walls: RoomWall[];
  wallThickness: number;
  wallColor: string;
  floorColor: string;
  openings: RoomOpening[];
  placements: RoomPlacement[];
  /** Outlines read from a plan (BICs, kitchen, island…) for reference. */
  fixtures?: RoomFixture[];
  /** freestanding / partition walls and pillars inside the room (pantry, scullery, divider…) */
  partitions?: Partition[];
  /** floor finish: tiles (default 1200 × 1200, colour matched to the kitchen), wood or plain */
  floor?: { kind: 'tiles' | 'wood' | 'plain'; tileSize: number; color: string | null; grout: string };
  /** snap items to walls and to each other while dragging on the plan */
  snap?: { on: boolean; within: number; gap: number };
  /** show the ceiling in renders (seen from inside the room) */
  ceiling?: boolean;
  ceilingColor?: string;
}

/** A wall standing on its own inside the room, or a pillar. */
export interface Partition {
  id: ID;
  kind: 'wall' | 'pillar';
  /** wall: start point on the plan; pillar: centre */
  x: number;
  z: number;
  /** wall: length along `angle`; pillar: width */
  length: number;
  angle: number;
  /** wall: thickness; pillar: depth */
  thickness: number;
  height: number;
  /** a door gap in a partition wall (e.g. into the scullery) */
  door?: { offset: number; width: number; height: number } | null;
  label?: string;
}

/* ----------------------------------------------------- invoices / receipts */

export interface InvoiceLine {
  id: ID;
  description: string;
  qty: number;
  unitPrice: number; // negative for a credit
  /** A change from the quoted work (extra or credit), with its reason. */
  kind?: 'item' | 'deviation';
  reason?: string;
  credit?: boolean; // deviation that reduces the total
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

/* =============================================================== trades */

export type Trade = 'joinery' | 'ceilings' | 'tiling';

/** A priced extra you pick from a list (ceiling designs, pendants, demolition, transport…). */
export interface PresetItem {
  id: ID;
  name: string;
  unit: string;
  price: number;
}

/* -------------------------------------------------------------- ceilings */

export type CeilingSystem = 'rhino' | 'pvc';
export type CeilingProductKind = 'board' | 'pvc' | 'brandering' | 'cornice' | 'trim' | 'fixing' | 'tape' | 'filler' | 'adhesive' | 'paint' | 'insulation' | 'other';

export interface CeilingProduct {
  id: ID;
  kind: CeilingProductKind;
  name: string;
  /** what it is sold as: sheet, strip, length, box, roll, bag, tub, tin */
  unit: string;
  price: number;
  /** boards, strips and lengths (mm) */
  length?: number;
  width?: number;
  /** paint / insulation / filler: m² per unit · tape / adhesive: m per unit · fixings: pieces per box */
  coverage?: number;
  colour?: string;
  system?: CeilingSystem | 'both';
}

export interface CeilingDesignLine {
  id: ID;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export interface CeilingArea {
  id: ID;
  name: string;
  /** room size (mm) */
  length: number;
  width: number;
  /** override the area (m²) / perimeter (m) for odd-shaped rooms */
  area?: number | null;
  perimeter?: number | null;
  system: CeilingSystem;
  boardId: ID | null;
  branderingId: ID | null;
  /** brandering centres (mm) */
  branderingSpacing: number;
  /** roof truss centres (mm) the brandering is nailed to */
  trussSpacing: number;
  corniceId: ID | null;
  paintId: ID | null;
  coats: number;
  colour: string;
  insulationId: ID | null;
  downlights: number;
  /** renovation: take the old ceiling down first */
  demolish: boolean;
  designs: CeilingDesignLine[];
  notes: string;
}

export interface CeilingJob {
  areas: CeilingArea[];
  extras: ExtraLine[];
  markupPercent: number;
  wastePercent: number;
}

export interface CeilingRates {
  rhinoPerM2: number;
  pvcPerM2: number;
  cornicePerM: number;
  paintPerM2: number;
  insulationPerM2: number;
  demolitionPerM2: number;
  downlightEach: number;
  markupPercent: number;
  wastePercent: number;
}

/* ---------------------------------------------------------------- tiling */

export type TileType = 'ceramic' | 'porcelain' | 'stone' | 'mosaic' | 'vinyl' | 'other';
export type TileFinish = 'matt' | 'gloss' | 'polished' | 'textured';

export interface TileProduct {
  id: ID;
  name: string;
  type: TileType;
  /** tile size (mm) */
  width: number;
  height: number;
  thickness: number;
  /** tiles in a box */
  perBox: number;
  /** price per box */
  price: number;
  colour: string;
  finish: TileFinish;
}

export type TileSupplyKind = 'adhesive' | 'grout' | 'spacers' | 'levelling' | 'trim' | 'waterproofing' | 'primer' | 'silicone' | 'screed' | 'other';

export interface TileSupply {
  id: ID;
  kind: TileSupplyKind;
  name: string;
  unit: string;
  price: number;
  /** adhesive / grout: kg per bag · spacers / clips: pieces per pack · trim: m per length · waterproofing / primer / screed: m² per unit · silicone: m per tube */
  coverage: number;
}

export type TilePattern = 'straight' | 'brick' | 'diagonal' | 'herringbone' | 'chevron';

export interface TileArea {
  id: ID;
  name: string;
  surface: 'floor' | 'wall';
  /** floor: length × width · wall: wall length × tiled height (mm) */
  length: number;
  width: number;
  /** m² not tiled (doors, windows, built-in units) */
  deduct: number;
  tileId: ID | null;
  pattern: TilePattern;
  /** waste % (blank = by pattern) */
  waste?: number | null;
  /** joint width (mm) */
  joint: number;
  adhesiveId: ID | null;
  groutId: ID | null;
  spacersId: ID | null;
  levelling: boolean;
  /** edge / corner trims (m) */
  trimLength: number;
  trimId: ID | null;
  /** floors: skirting cut from the same tile */
  skirting: boolean;
  skirtingHeight: number;
  waterproof: boolean;
  primer: boolean;
  silicone: boolean;
  demolish: boolean;
  screed: boolean;
  notes: string;
}

export interface TilingJob {
  areas: TileArea[];
  extras: ExtraLine[];
  markupPercent: number;
}

export interface TilingRates {
  floorPerM2: number;
  wallPerM2: number;
  skirtingPerM: number;
  demolitionPerM2: number;
  screedPerM2: number;
  waterproofPerM2: number;
  /** extra labour % for harder layouts */
  patternExtra: Record<TilePattern, number>;
  /** extra labour % for tiles 600 mm and larger on any side */
  largeFormatExtra: number;
  markupPercent: number;
}
