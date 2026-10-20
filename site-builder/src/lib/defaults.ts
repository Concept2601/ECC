import type { MenuItem, Page, Site, Theme } from '../types';
import { createBlock } from './blocks';
import { slugify, uid } from './util';

export const FONT_OPTIONS = [
  'Inter',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'DM Sans',
  'Lora',
  'Space Grotesk',
  'Merriweather',
  'Outfit',
  'Cormorant Garamond',
  'Manrope',
  'Archivo',
  'system-ui',
];

export const DEFAULT_THEME: Theme = {
  primary: '#4f46e5',
  accent: '#f59e0b',
  background: '#ffffff',
  surface: '#f5f6fa',
  text: '#111827',
  muted: '#5b6475',
  dark: '#0f172a',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  baseSize: 17,
  radius: 12,
  maxWidth: 1180,
  buttonStyle: 'solid',
  headingWeight: 700,
};

export function createPage(name: string, slug?: string): Page {
  return {
    id: uid('pg'),
    name,
    slug: slug ?? slugify(name),
    blocks: [],
    seo: { title: '', description: '', focusKeyword: '', noindex: false },
  };
}

export const menuFromPages = (pages: Page[]): MenuItem[] =>
  pages.map((p) => ({ id: uid('mi'), label: p.name, pageId: p.id }));

export function createSite(name: string, partial: Partial<Site> = {}): Site {
  const home = createPage('Home', '');
  home.blocks = [createBlock('hero'), createBlock('features'), createBlock('cta')];
  const pages = partial.pages ?? [home];
  const now = Date.now();
  const slug = slugify(name) || 'my-site';
  return {
    id: uid('site'),
    name,
    createdAt: now,
    updatedAt: now,
    theme: { ...DEFAULT_THEME },
    pages,
    menus: { main: menuFromPages(pages), footer: [] },
    media: [],
    performance: {
      minify: true,
      lazyLoad: true,
      responsiveImages: true,
      convertToWebp: true,
      imageQuality: 0.82,
      maxImageWidth: 1920,
      preconnectFonts: true,
      fontDisplaySwap: true,
      inlineCss: true,
      videoPreload: 'metadata',
      pageWeightBudgetKb: 1500,
    },
    seo: {
      siteName: name,
      titleTemplate: `%s | ${name}`,
      defaultDescription: '',
      twitterHandle: '',
      language: 'en',
      schemaType: 'Organization',
      businessPhone: '',
      businessAddress: '',
      googleVerification: '',
      bingVerification: '',
      generateSitemap: true,
      allowIndexing: true,
    },
    hosting: {
      provider: 'self',
      slug,
      serverUrl: '',
      serverToken: '',
      netlifyToken: '',
      netlifySiteId: '',
      httpsRedirect: true,
      securityHeaders: true,
      cacheAssetsDays: 30,
    },
    domains: { domains: [], targetIp: '', targetCname: '' },
    redirects: [],
    integrations: {
      formEndpoint: 'self',
      customFormAction: '',
      ga4Id: '',
      plausibleDomain: '',
      metaPixelId: '',
      cookieBanner: false,
      cookieText: 'We use cookies to improve your experience and analyse traffic.',
      headCode: '',
      bodyCode: '',
      whatsappNumber: '',
    },
    settings: {
      logoText: name,
      announcement: '',
      footerText: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
      socials: [],
      notFoundHeading: 'Page not found',
      notFoundBody: 'The page you are looking for has moved or no longer exists.',
      passwordProtect: false,
      password: '',
      maintenanceMode: false,
    },
    versions: [],
    deployments: [],
    ...partial,
  };
}
