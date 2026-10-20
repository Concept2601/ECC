import { describe, expect, it } from 'vitest';
import { extract } from './inspect.js';

const html = `<!doctype html><html><head><title>Bloom Studio</title>
<meta name="description" content="Florals for events">
<meta name="theme-color" content="#e11d48">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato&display=swap" rel="stylesheet">
<style>.btn{background:#e11d48;color:#fff}.x{color:#0ea5e9}.y{border-color:#0ea5e9}.g{color:#777777}</style></head>
<body><nav><a href="/">Home</a><a href="/about">About us</a><a href="/shop">Shop</a><a href="/login">Log in</a></nav>
<h1>Flowers that <em>speak</em></h1><section>Trusted by 200 brides</section><section>Our services</section>
<section>What our clients say</section><section>Pricing plans</section><form></form></body></html>`;

describe('inspiration extract', () => {
  it('pulls palette, fonts, navigation and section order', () => {
    const r = extract(html, '', 'https://bloom.test/');
    expect(r.title).toBe('Bloom Studio');
    expect(r.description).toBe('Florals for events');
    expect(r.colors.slice(0, 2)).toEqual(['#e11d48', '#0ea5e9']);
    expect(r.colors).not.toContain('#777777');
    expect(r.fonts).toEqual(['Playfair Display', 'Lato']);
    expect(r.navLabels).toEqual(['Home', 'About us', 'Shop']);
    expect(r.headings[0]).toBe('Flowers that speak');
    expect(r.sections).toEqual(['hero', 'logos', 'features', 'testimonials', 'pricing', 'contact']);
  });
});
