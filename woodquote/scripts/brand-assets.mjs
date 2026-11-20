// Regenerates every En-Quote icon and splash screen from brand/mark.mjs.
//   node scripts/brand-assets.mjs
// Needs Playwright's Chromium (draws the SVGs) and ImageMagick (Windows .ico).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COLORS, DEFS, adaptiveForegroundSvg, iconSvg, markSvg } from '../brand/mark.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/@playwright/test/index.mjs')).href);
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();

// fonts are embedded (a page set from a string cannot load local files)
const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules/@fontsource', f)).toString('base64')}`;
const fontCss = `@font-face{font-family:Outfit;font-weight:300;src:url(${font('outfit/files/outfit-latin-300-normal.woff2')})}@font-face{font-family:Outfit;font-weight:500;src:url(${font('outfit/files/outfit-latin-500-normal.woff2')})}`;

async function png(svgOrHtml, w, h, out, transparent = true) {
  const html = svgOrHtml.startsWith('<svg') ? `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svgOrHtml}` : svgOrHtml;
  await page.setViewportSize({ width: Math.max(w, 400), height: Math.max(h, 400) });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  console.log('wrote', out.replace(root + '/', ''), `${w}×${h}`);
}

/** Splash: graphite with the stacked lockup (mark, wordmark, credit). */
const splash = (w, h) => {
  const s = Math.min(w, h);
  const mk = Math.round(s * 0.22);
  return `<style>${fontCss}html,body{margin:0}body{width:${w}px;height:${h}px;display:grid;place-items:center;background:radial-gradient(120% 100% at 50% 0%,#26303B 0%,#12171C 55%,#0B0F13 100%);font-family:Outfit}
  .s{display:grid;justify-items:center;gap:${Math.round(s * 0.03)}px}.wm{font-size:${Math.round(s * 0.09)}px;color:${COLORS.paper};letter-spacing:.02em;line-height:1}.wm .a{font-weight:300}.wm .sl{font-weight:300;color:${COLORS.blueHi}}.wm .b{font-weight:500}
  .by{font-weight:300;font-size:${Math.max(10, Math.round(s * 0.022))}px;letter-spacing:.32em;text-transform:uppercase;color:rgba(242,244,246,.55)}</style>
  <div class="s"><svg viewBox="0 0 120 120" width="${mk}" height="${mk}"><defs>${DEFS}</defs>${markSvg()}</svg><div class="wm"><span class="a">En</span><span class="sl">/</span><span class="b">Quote</span></div><div class="by">by Sir 2601 · Think Different</div></div>`;
};

// web
writeFileSync(join(root, 'public/favicon.svg'), iconSvg({ size: 120 }));
await png(iconSvg({ size: 512 }), 512, 512, join(root, 'public/icon-512.png'));
await png(iconSvg({ size: 192 }), 192, 192, join(root, 'public/icon-192.png'));
await png(iconSvg({ rounded: false, size: 180 }), 180, 180, join(root, 'public/apple-touch-icon.png'), false);

// Windows / desktop
await png(iconSvg({ size: 1024 }), 1024, 1024, join(root, 'desktop/build/icon.png'));
const icoParts = [];
for (const s of [16, 24, 32, 48, 64, 128, 256]) {
  const p = join(root, `desktop/build/ico-${s}.png`);
  await png(iconSvg({ size: s, small: s < 32 }), s, s, p);
  icoParts.push(p);
}
try {
  execFileSync('convert', [...icoParts, join(root, 'desktop/build/icon.ico')]);
  console.log('wrote desktop/build/icon.ico');
} catch (e) {
  console.warn('ImageMagick not found: skipped icon.ico', e.message);
}
for (const p of icoParts) execFileSync('rm', ['-f', p]);

// Android launcher icons
const res = join(root, 'android/app/src/main/res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);
  await png(iconSvg({ size: legacy }), legacy, legacy, join(res, `mipmap-${d}/ic_launcher.png`));
  await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${legacy}" height="${legacy}"><defs>${DEFS}<clipPath id="c"><circle cx="60" cy="60" r="60"/></clipPath></defs><g clip-path="url(#c)"><rect width="120" height="120" fill="url(#eqtile)"/><g transform="translate(13 13) scale(.783)">${markSvg()}</g></g></svg>`, legacy, legacy, join(res, `mipmap-${d}/ic_launcher_round.png`));
  await png(adaptiveForegroundSvg(fg), fg, fg, join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  await png(adaptiveForegroundSvg(fg, true), fg, fg, join(res, `mipmap-${d}/ic_launcher_monochrome.png`));
}
writeFileSync(join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1A2129</color>\n</resources>\n`);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>`;
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

// Android splash screens (same sizes as before)
const splashes = { drawable: [480, 800], 'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280], 'drawable-port-mdpi': [320, 320], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920] };
for (const [dir, [w, h]] of Object.entries(splashes)) await png(splash(w, h), w, h, join(res, dir, 'splash.png'), false);

// iOS
const ios = join(root, 'ios/App/App/Assets.xcassets');
await png(iconSvg({ rounded: false, size: 1024 }), 1024, 1024, join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'), false);
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await png(splash(2732, 2732), 2732, 2732, join(ios, 'Splash.imageset', f), false);

await browser.close();
