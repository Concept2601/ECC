import type { Block, BlockType, Item } from '../types';
import { uid } from './util';

export interface BlockMeta {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  hasItems?: boolean;
  itemLabel?: string;
  itemFields?: (keyof Item)[];
}

export const BLOCKS: BlockMeta[] = [
  { type: 'hero', label: 'Hero', icon: '★', description: 'Headline, intro and call-to-action with optional image' },
  { type: 'features', label: 'Features', icon: '▦', description: 'Grid of benefits or services', hasItems: true, itemLabel: 'Feature', itemFields: ['icon', 'title', 'text', 'mediaId'] },
  { type: 'richtext', label: 'Text', icon: '¶', description: 'Rich text content written in the editor' },
  { type: 'image', label: 'Image', icon: '▣', description: 'Single image with optional caption' },
  { type: 'video', label: 'Video', icon: '▶', description: 'Uploaded video or YouTube / Vimeo embed' },
  { type: 'gallery', label: 'Gallery', icon: '▤', description: 'Responsive image grid', hasItems: true, itemLabel: 'Image', itemFields: ['mediaId', 'title'] },
  { type: 'cta', label: 'Call to action', icon: '➜', description: 'Conversion banner with buttons' },
  { type: 'testimonials', label: 'Testimonials', icon: '❝', description: 'Social proof quotes', hasItems: true, itemLabel: 'Testimonial', itemFields: ['text', 'title', 'icon', 'mediaId'] },
  { type: 'pricing', label: 'Pricing', icon: '$', description: 'Plans and price cards', hasItems: true, itemLabel: 'Plan', itemFields: ['title', 'price', 'text', 'features', 'link', 'highlight'] },
  { type: 'faq', label: 'FAQ', icon: '?', description: 'Accordion of questions (adds FAQ rich results)', hasItems: true, itemLabel: 'Question', itemFields: ['title', 'text'] },
  { type: 'stats', label: 'Stats', icon: '#', description: 'Key numbers that build trust', hasItems: true, itemLabel: 'Stat', itemFields: ['title', 'text'] },
  { type: 'logos', label: 'Logo strip', icon: '◎', description: 'Client / partner logos', hasItems: true, itemLabel: 'Logo', itemFields: ['title', 'mediaId', 'link'] },
  { type: 'team', label: 'Team', icon: '☺', description: 'People and roles', hasItems: true, itemLabel: 'Member', itemFields: ['mediaId', 'title', 'text'] },
  { type: 'contact', label: 'Contact form', icon: '✉', description: 'Lead capture form wired to your back-end' },
];

export const blockMeta = (t: BlockType) => BLOCKS.find((b) => b.type === t)!;

const item = (p: Partial<Item>): Item => ({ id: uid('it'), ...p });

export function createBlock(type: BlockType, overrides: Partial<Block> = {}): Block {
  const base: Block = { id: uid('blk'), type, tone: 'default', spacing: 'md', align: 'left' };
  const defaults: Record<BlockType, Partial<Block>> = {
    hero: {
      eyebrow: 'New',
      heading: 'A headline that explains your value',
      body: '<p>One or two sentences that tell visitors exactly what you do and why it matters to them.</p>',
      ctaLabel: 'Get started',
      ctaLink: '#contact',
      secondaryLabel: 'Learn more',
      secondaryLink: '#features',
      layout: 'split',
      spacing: 'lg',
    },
    features: {
      heading: 'Why choose us',
      body: '<p>Everything you need, nothing you don’t.</p>',
      columns: 3,
      align: 'center',
      items: [
        item({ icon: '⚡', title: 'Fast', text: 'Pages load in under a second on any device.' }),
        item({ icon: '🛡', title: 'Secure', text: 'HTTPS and security headers out of the box.' }),
        item({ icon: '📈', title: 'Found', text: 'Built-in SEO helps customers find you.' }),
      ],
    },
    richtext: {
      heading: 'About us',
      body: '<p>Tell your story here. Use the editor toolbar for <strong>bold</strong>, <em>italic</em>, lists and links.</p>',
    },
    image: { heading: '', body: '' },
    video: { heading: 'See it in action', align: 'center' },
    gallery: { heading: 'Gallery', columns: 3, items: [] },
    cta: {
      heading: 'Ready to get started?',
      body: '<p>Join hundreds of happy customers today.</p>',
      ctaLabel: 'Contact us',
      ctaLink: '#contact',
      tone: 'primary',
      align: 'center',
    },
    testimonials: {
      heading: 'What clients say',
      columns: 3,
      align: 'center',
      tone: 'alt',
      items: [
        item({ text: '“They transformed our online presence. Enquiries doubled in a month.”', title: 'Tariro M.', icon: 'Founder, Bloom Co.' }),
        item({ text: '“Professional, fast and easy to work with.”', title: 'James K.', icon: 'CEO, Northwind' }),
        item({ text: '“The best investment we made this year.”', title: 'Aisha N.', icon: 'Director, Lumen' }),
      ],
    },
    pricing: {
      heading: 'Simple pricing',
      align: 'center',
      columns: 3,
      items: [
        item({ title: 'Starter', price: '$19/mo', text: 'For individuals', features: 'One site\nFree SSL\nEmail support', link: '#contact' }),
        item({ title: 'Business', price: '$49/mo', text: 'For growing teams', features: 'Five sites\nCustom domain\nPriority support', link: '#contact', highlight: true }),
        item({ title: 'Agency', price: '$99/mo', text: 'For agencies', features: 'Unlimited sites\nClient handover\nWhite label', link: '#contact' }),
      ],
    },
    faq: {
      heading: 'Frequently asked questions',
      items: [
        item({ title: 'How long does setup take?', text: 'Most customers launch within a day.' }),
        item({ title: 'Can I use my own domain?', text: 'Yes — connect any domain you own in minutes.' }),
      ],
    },
    stats: {
      align: 'center',
      columns: 4,
      tone: 'dark',
      items: [
        item({ title: '250+', text: 'Projects delivered' }),
        item({ title: '98%', text: 'Client satisfaction' }),
        item({ title: '12', text: 'Countries' }),
        item({ title: '24/7', text: 'Support' }),
      ],
    },
    logos: { heading: 'Trusted by', align: 'center', spacing: 'sm', items: [item({ title: 'Acme' }), item({ title: 'Globex' }), item({ title: 'Initech' }), item({ title: 'Umbrella' })] },
    team: {
      heading: 'Meet the team',
      align: 'center',
      columns: 3,
      items: [item({ title: 'Alex Moyo', text: 'Founder' }), item({ title: 'Sam Dube', text: 'Design lead' }), item({ title: 'Rudo Banda', text: 'Engineering' })],
    },
    contact: {
      heading: 'Get in touch',
      body: '<p>Send us a message and we’ll reply within one business day.</p>',
      ctaLabel: 'Send message',
      layout: 'split',
    },
  };
  return { ...base, ...defaults[type], ...overrides, id: base.id };
}

export const newItem = (type: BlockType): Item => {
  const meta = blockMeta(type);
  return item({ title: `New ${meta.itemLabel?.toLowerCase() ?? 'item'}`, text: '' });
};
