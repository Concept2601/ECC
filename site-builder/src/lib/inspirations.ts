import type { Block, BlockType, Page, Site, Theme } from '../types';
import { createBlock } from './blocks';
import { createPage, createSite, DEFAULT_THEME, menuFromPages } from './defaults';

type BlockSpec = [BlockType, Partial<Block>?];
interface PageSpec {
  name: string;
  slug?: string;
  blocks: BlockSpec[];
  description?: string;
}

export interface Inspiration {
  id: string;
  name: string;
  category: string;
  description: string;
  inspiredBy: string;
  theme: Partial<Theme>;
  pages: PageSpec[];
}

export const INSPIRATIONS: Inspiration[] = [
  {
    id: 'think-different',
    name: 'Think Different',
    category: 'Software & Startups',
    description: 'Bold, minimal product launch: black hero, giant type, monochrome buttons and spectrum accents.',
    inspiredBy: 'Classic keynote-style product pages',
    theme: { primary: '#1d1d1f', accent: '#009ddc', background: '#ffffff', surface: '#f5f5f7', text: '#1d1d1f', muted: '#6e6e73', dark: '#000000', headingFont: 'Inter', bodyFont: 'Inter', headingWeight: 800, radius: 20, buttonStyle: 'pill', maxWidth: 1080 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Here’s to the ones who see things differently. Meet the product that changes everything.',
        blocks: [
          ['hero', { tone: 'dark', layout: 'stacked', align: 'center', eyebrow: 'Introducing', heading: 'Think different.', body: '<p>Here’s to the ones who see things differently. A product made for the crazy ones.</p>', ctaLabel: 'Pre-order', ctaLink: '#pricing', secondaryLabel: 'Watch the film', secondaryLink: '#features', spacing: 'lg' }],
          ['features', { heading: 'Designed to be different', align: 'center', columns: 3 }],
          ['video', { heading: 'See it move', tone: 'dark' }],
          ['stats', { tone: 'default' }],
          ['pricing', { heading: 'Pick yours', align: 'center' }],
          ['cta', { tone: 'dark', heading: 'The future is yours to make.', ctaLabel: 'Get started' }],
        ],
      },
      { name: 'Story', blocks: [['richtext', { heading: 'Our story', spacing: 'lg', align: 'center' }], ['team', { heading: 'The crazy ones' }]] },
      { name: 'Contact', blocks: [['contact', { spacing: 'lg' }]] },
    ],
  },
  {
    id: 'saas-minimal',
    name: 'Minimal SaaS',
    category: 'Software & Startups',
    description: 'Crisp product site with generous whitespace, feature grids and pricing.',
    inspiredBy: 'Linear, Stripe, Vercel',
    theme: { primary: '#5b5bd6', accent: '#10b981', headingFont: 'Inter', bodyFont: 'Inter', radius: 10, headingWeight: 700 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'The modern platform that helps teams ship faster.',
        blocks: [
          ['hero', { eyebrow: 'Now in public beta', heading: 'Ship better products, faster', body: '<p>The workspace that keeps product teams aligned — from roadmap to release.</p>', ctaLabel: 'Start free trial' }],
          ['logos'],
          ['features', { heading: 'Built for modern teams' }],
          ['stats'],
          ['testimonials'],
          ['pricing'],
          ['faq'],
          ['cta', { heading: 'Start building today', ctaLabel: 'Create free account' }],
        ],
      },
      { name: 'Features', blocks: [['hero', { heading: 'Every tool your team needs', layout: 'stacked', align: 'center' }], ['features', { columns: 3 }], ['video'], ['cta']] },
      { name: 'Pricing', blocks: [['pricing', { spacing: 'lg' }], ['faq'], ['cta']] },
      { name: 'Contact', blocks: [['contact', { spacing: 'lg' }]] },
    ],
  },
  {
    id: 'agency-bold',
    name: 'Bold Agency',
    category: 'Creative & Agencies',
    description: 'High-contrast dark hero, big type and showcase galleries.',
    inspiredBy: 'Pentagram, Huge, Instrument',
    theme: { primary: '#ff4d2e', accent: '#d9f99d', background: '#ffffff', dark: '#0b0b0c', text: '#0b0b0c', headingFont: 'Space Grotesk', bodyFont: 'DM Sans', radius: 0, headingWeight: 700, buttonStyle: 'pill' },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Independent creative studio crafting brands and digital experiences.',
        blocks: [
          ['hero', { tone: 'dark', eyebrow: 'Creative studio', heading: 'We build brands people remember', layout: 'stacked', ctaLabel: 'See our work', ctaLink: '/work' }],
          ['stats', { tone: 'default' }],
          ['gallery', { heading: 'Selected work', columns: 2 }],
          ['features', { heading: 'Services', columns: 4, align: 'left' }],
          ['testimonials', { tone: 'dark' }],
          ['cta', { heading: 'Have a project in mind?', ctaLabel: 'Let’s talk' }],
        ],
      },
      { name: 'Work', blocks: [['gallery', { heading: 'Our work', columns: 3, spacing: 'lg' }], ['cta']] },
      { name: 'About', blocks: [['richtext', { heading: 'Our story', spacing: 'lg' }], ['team'], ['stats']] },
      { name: 'Contact', blocks: [['contact']] },
    ],
  },
  {
    id: 'restaurant-elegant',
    name: 'Elegant Restaurant',
    category: 'Food & Hospitality',
    description: 'Warm serif typography, menu sections, gallery and reservations.',
    inspiredBy: 'Noma, Dishoom, Nobu',
    theme: { primary: '#8b5e34', accent: '#c9a227', background: '#fbf8f3', surface: '#f2ebe0', text: '#2a2118', muted: '#6b5d4f', dark: '#1d1611', headingFont: 'Playfair Display', bodyFont: 'Lora', radius: 4, headingWeight: 600 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Seasonal dining, crafted with local ingredients.',
        blocks: [
          ['hero', { layout: 'cover', tone: 'dark', eyebrow: 'Est. 2012', heading: 'Seasonal plates, unforgettable evenings', ctaLabel: 'Book a table', ctaLink: '/reservations', align: 'center' }],
          ['richtext', { heading: 'Our kitchen', align: 'center' }],
          ['gallery', { heading: '', columns: 3 }],
          ['testimonials'],
          ['cta', { heading: 'Reserve your table', ctaLabel: 'Book now', ctaLink: '/reservations' }],
        ],
      },
      { name: 'Menu', blocks: [['pricing', { heading: 'Tasting menu', columns: 3 }], ['faq', { heading: 'Dietary requirements' }]] },
      { name: 'Reservations', blocks: [['contact', { heading: 'Book a table', ctaLabel: 'Request booking' }]] },
    ],
  },
  {
    id: 'portfolio-creative',
    name: 'Creative Portfolio',
    category: 'Personal & Portfolio',
    description: 'Personal brand with project gallery, about and contact.',
    inspiredBy: 'Behance, Dribbble pro portfolios',
    theme: { primary: '#111111', accent: '#7c3aed', background: '#fafafa', surface: '#efefef', headingFont: 'Outfit', bodyFont: 'Manrope', radius: 16, buttonStyle: 'outline' },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Designer & photographer portfolio.',
        blocks: [
          ['hero', { eyebrow: 'Designer · Photographer', heading: 'Hi, I’m Rumbi. I design calm, useful things.', layout: 'stacked', ctaLabel: 'View projects', ctaLink: '#work' }],
          ['gallery', { heading: 'Projects', columns: 2 }],
          ['logos', { heading: 'Clients' }],
          ['cta', { heading: 'Open for freelance', ctaLabel: 'Say hello', ctaLink: '/contact' }],
        ],
      },
      { name: 'About', blocks: [['richtext', { heading: 'About me' }], ['stats', { tone: 'alt' }]] },
      { name: 'Contact', blocks: [['contact']] },
    ],
  },
  {
    id: 'local-service',
    name: 'Local Service',
    category: 'Local Business',
    description: 'Trust-first layout for trades, clinics and consultants with strong CTAs.',
    inspiredBy: 'Top-ranking local service sites',
    theme: { primary: '#0e7490', accent: '#f97316', headingFont: 'Poppins', bodyFont: 'Inter', radius: 8 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Reliable, licensed and insured local experts.',
        blocks: [
          ['hero', { eyebrow: 'Licensed & insured', heading: 'Reliable experts, same-day service', ctaLabel: 'Get a free quote', secondaryLabel: 'Call now', secondaryLink: 'tel:+0000000000' }],
          ['features', { heading: 'Our services' }],
          ['stats', { tone: 'primary' }],
          ['testimonials'],
          ['faq'],
          ['contact', { heading: 'Request a free quote' }],
        ],
      },
      { name: 'Services', blocks: [['features', { columns: 2, spacing: 'lg' }], ['cta']] },
      { name: 'About', blocks: [['richtext'], ['team']] },
      { name: 'Contact', blocks: [['contact']] },
    ],
  },
  {
    id: 'boutique-shop',
    name: 'Boutique Store',
    category: 'Retail & E-commerce',
    description: 'Product-led showcase with collections, pricing cards and reviews.',
    inspiredBy: 'Aesop, Glossier, Allbirds',
    theme: { primary: '#1f2937', accent: '#e11d48', background: '#fffdfb', surface: '#f6f1ec', headingFont: 'Cormorant Garamond', bodyFont: 'DM Sans', radius: 2, headingWeight: 600, buttonStyle: 'solid' },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Thoughtfully made products for everyday rituals.',
        blocks: [
          ['hero', { layout: 'cover', tone: 'dark', heading: 'Made slowly. Made to last.', ctaLabel: 'Shop the collection', ctaLink: '/shop' }],
          ['gallery', { heading: 'New arrivals', columns: 4 }],
          ['features', { heading: 'Our promise', columns: 3 }],
          ['testimonials'],
          ['cta', { heading: 'Free shipping over $50', tone: 'alt' }],
        ],
      },
      { name: 'Shop', blocks: [['pricing', { heading: 'Collection', columns: 3 }]] },
      { name: 'Our story', slug: 'story', blocks: [['richtext'], ['image']] },
      { name: 'Contact', blocks: [['contact'], ['faq']] },
    ],
  },
  {
    id: 'nonprofit',
    name: 'Non-profit',
    category: 'Community & Causes',
    description: 'Mission-driven storytelling with impact stats and donation CTA.',
    inspiredBy: 'charity: water, WWF',
    theme: { primary: '#047857', accent: '#facc15', headingFont: 'Montserrat', bodyFont: 'Merriweather', radius: 12, headingWeight: 800 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Bringing clean water to every community.',
        blocks: [
          ['hero', { layout: 'cover', tone: 'dark', heading: 'Every community deserves clean water', ctaLabel: 'Donate now', align: 'center' }],
          ['stats'],
          ['richtext', { heading: 'Our mission' }],
          ['video'],
          ['cta', { heading: 'Your gift changes lives', ctaLabel: 'Give today', tone: 'primary' }],
        ],
      },
      { name: 'Our work', slug: 'work', blocks: [['features'], ['gallery']] },
      { name: 'Get involved', slug: 'get-involved', blocks: [['pricing', { heading: 'Ways to give' }], ['contact', { heading: 'Volunteer with us' }]] },
    ],
  },
  {
    id: 'event-conference',
    name: 'Event & Conference',
    category: 'Events',
    description: 'Countdown-style hero, speakers, schedule and ticket tiers.',
    inspiredBy: 'Config, Web Summit',
    theme: { primary: '#db2777', accent: '#22d3ee', background: '#ffffff', dark: '#120a24', headingFont: 'Archivo', bodyFont: 'Inter', radius: 18, buttonStyle: 'pill', headingWeight: 800 },
    pages: [
      {
        name: 'Home',
        slug: '',
        description: 'Two days of talks, workshops and networking.',
        blocks: [
          ['hero', { tone: 'dark', eyebrow: 'March 12–13 · Harare', heading: 'The future of African tech, live', ctaLabel: 'Get tickets', ctaLink: '#pricing', layout: 'stacked', align: 'center' }],
          ['stats'],
          ['team', { heading: 'Speakers', columns: 4 }],
          ['pricing', { heading: 'Tickets' }],
          ['logos', { heading: 'Sponsors' }],
          ['faq'],
        ],
      },
      { name: 'Schedule', blocks: [['richtext', { heading: 'Schedule' }]] },
      { name: 'Contact', blocks: [['contact']] },
    ],
  },
];

function buildPages(specs: PageSpec[]): Page[] {
  return specs.map((s) => {
    const p = createPage(s.name, s.slug);
    p.blocks = s.blocks.map(([t, o]) => createBlock(t, o));
    p.seo.description = s.description ?? '';
    return p;
  });
}

export function siteFromInspiration(insp: Inspiration, name: string): Site {
  const pages = buildPages(insp.pages);
  const site = createSite(name, { pages, inspiration: insp.name });
  site.theme = { ...DEFAULT_THEME, ...insp.theme };
  site.menus.main = menuFromPages(pages);
  site.seo.defaultDescription = insp.pages[0]?.description ?? '';
  return site;
}

/** Result shape of the server's /api/inspect endpoint */
export interface InspectResult {
  url: string;
  title: string;
  description: string;
  colors: string[];
  fonts: string[];
  headings: string[];
  sections: BlockType[];
  navLabels: string[];
}

export function siteFromInspection(r: InspectResult, name: string): Site {
  const [primary, accent] = r.colors;
  const theme: Theme = { ...DEFAULT_THEME };
  if (primary) theme.primary = primary;
  if (accent) theme.accent = accent;
  if (r.fonts[0]) theme.headingFont = r.fonts[0];
  if (r.fonts[1] ?? r.fonts[0]) theme.bodyFont = r.fonts[1] ?? r.fonts[0];

  const sections: BlockType[] = r.sections.length ? r.sections : ['hero', 'features', 'cta'];
  const home = createPage('Home', '');
  home.blocks = sections.map((t, i) => createBlock(t, i === 0 && r.headings[0] ? { heading: r.headings[0] } : {}));
  home.seo.description = r.description;
  const extra = r.navLabels
    .filter((l) => !/^home$/i.test(l))
    .slice(0, 5)
    .map((l) => {
      const p = createPage(l);
      p.blocks = [createBlock('richtext', { heading: l, spacing: 'lg' })];
      return p;
    });
  const pages = [home, ...extra];
  const site = createSite(name, { pages, inspiration: r.url });
  site.theme = theme;
  site.menus.main = menuFromPages(pages);
  return site;
}
