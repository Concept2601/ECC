export type BlockType =
  | 'hero'
  | 'features'
  | 'richtext'
  | 'image'
  | 'video'
  | 'gallery'
  | 'cta'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'stats'
  | 'logos'
  | 'team'
  | 'contact';

export type SectionTone = 'default' | 'alt' | 'primary' | 'dark';
export type Spacing = 'sm' | 'md' | 'lg';

export interface Item {
  id: string;
  title?: string;
  text?: string;
  icon?: string;
  mediaId?: string;
  price?: string;
  features?: string;
  link?: string;
  highlight?: boolean;
}

export interface Block {
  id: string;
  type: BlockType;
  hidden?: boolean;
  tone: SectionTone;
  spacing: Spacing;
  align: 'left' | 'center';
  /** Eyebrow / kicker above the heading */
  eyebrow?: string;
  heading?: string;
  /** Rich HTML (sanitised on render) */
  body?: string;
  ctaLabel?: string;
  ctaLink?: string;
  secondaryLabel?: string;
  secondaryLink?: string;
  mediaId?: string;
  /** External video URL (YouTube / Vimeo / mp4) */
  videoUrl?: string;
  layout?: 'split' | 'stacked' | 'cover';
  columns?: 2 | 3 | 4;
  items?: Item[];
}

export interface PageSeo {
  title: string;
  description: string;
  focusKeyword: string;
  ogImageId?: string;
  canonical?: string;
  noindex: boolean;
}

export interface Page {
  id: string;
  name: string;
  slug: string; // '' for home
  blocks: Block[];
  seo: PageSeo;
}

export interface MenuItem {
  id: string;
  label: string;
  pageId?: string;
  url?: string;
  children?: MenuItem[];
}

export interface Theme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  dark: string;
  headingFont: string;
  bodyFont: string;
  baseSize: number;
  radius: number;
  maxWidth: number;
  buttonStyle: 'solid' | 'pill' | 'outline';
  headingWeight: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  kind: 'image' | 'video';
  mime: string;
  /** data: URL of the optimised master file */
  src: string;
  /** Responsive variants (width → data URL), images only */
  variants?: Record<number, string>;
  width?: number;
  height?: number;
  size: number;
  originalSize: number;
  alt: string;
  posterId?: string;
  createdAt: number;
}

export interface PerformanceSettings {
  minify: boolean;
  lazyLoad: boolean;
  responsiveImages: boolean;
  convertToWebp: boolean;
  imageQuality: number; // 0.4 – 1
  maxImageWidth: number;
  preconnectFonts: boolean;
  fontDisplaySwap: boolean;
  inlineCss: boolean;
  videoPreload: 'none' | 'metadata';
  pageWeightBudgetKb: number;
}

export interface SeoSettings {
  siteName: string;
  titleTemplate: string; // e.g. "%s | Brand"
  defaultDescription: string;
  defaultOgImageId?: string;
  twitterHandle: string;
  language: string;
  schemaType: 'Organization' | 'LocalBusiness' | 'Person' | 'WebSite';
  businessPhone: string;
  businessAddress: string;
  googleVerification: string;
  bingVerification: string;
  generateSitemap: boolean;
  allowIndexing: boolean;
}

export type HostingProvider = 'self' | 'netlify' | 'zip';

export interface HostingSettings {
  provider: HostingProvider;
  slug: string;
  serverUrl: string; // where the self-hosted server is reachable, '' = same origin
  serverToken: string;
  netlifyToken: string;
  netlifySiteId: string;
  /** e.g. my-site.netlify.app, learned on first deploy */
  netlifyHost?: string;
  httpsRedirect: boolean;
  securityHeaders: boolean;
  cacheAssetsDays: number;
}

export interface DomainRecord {
  id: string;
  host: string; // e.g. example.com or www.example.com
  primary: boolean;
  status: 'pending' | 'verified' | 'failed';
  lastChecked?: number;
  message?: string;
}

export interface DomainSettings {
  domains: DomainRecord[];
  targetIp: string; // A record target for apex
  targetCname: string; // CNAME target for subdomains
}

export interface Redirect {
  id: string;
  from: string;
  to: string;
  code: 301 | 302;
}

export interface IntegrationSettings {
  formEndpoint: 'self' | 'custom';
  customFormAction: string;
  ga4Id: string;
  plausibleDomain: string;
  metaPixelId: string;
  cookieBanner: boolean;
  cookieText: string;
  headCode: string;
  bodyCode: string;
  whatsappNumber: string;
}

export interface SiteSettings {
  favicon?: string; // media id
  logoId?: string;
  logoText: string;
  announcement: string;
  footerText: string;
  socials: { id: string; network: string; url: string }[];
  notFoundHeading: string;
  notFoundBody: string;
  passwordProtect: boolean;
  password: string;
  maintenanceMode: boolean;
}

export interface Deployment {
  id: string;
  at: number;
  provider: HostingProvider;
  url?: string;
  status: 'success' | 'failed';
  message: string;
  versionId: string;
  bytes: number;
}

export interface Version {
  id: string;
  at: number;
  label: string;
  snapshot: string; // JSON of Site without versions/deployments
}

export interface Site {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  inspiration?: string;
  theme: Theme;
  pages: Page[];
  menus: { main: MenuItem[]; footer: MenuItem[] };
  media: MediaAsset[];
  performance: PerformanceSettings;
  seo: SeoSettings;
  hosting: HostingSettings;
  domains: DomainSettings;
  redirects: Redirect[];
  integrations: IntegrationSettings;
  settings: SiteSettings;
  versions: Version[];
  deployments: Deployment[];
}
