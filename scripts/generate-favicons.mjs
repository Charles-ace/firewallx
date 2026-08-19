import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SVG_PATH = path.join(process.cwd(), 'public/logo.svg');
const FAVICON_SVG_PATH = path.join(process.cwd(), 'public/favicon.svg');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');
const favSvgContent = fs.readFileSync(FAVICON_SVG_PATH, 'utf-8');

async function renderSvgToPng(page, svg, size, outputPath) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            overflow: hidden;
          }
          svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        ${svg}
      </body>
    </html>
  `;

  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({
    path: outputPath,
    omitBackground: true,
    type: 'png',
  });
  console.log(`Generated: ${path.basename(outputPath)} (${size}x${size})`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  // 16x16 Favicon (from high-contrast favSvg)
  await renderSvgToPng(page, favSvgContent, 16, path.join(PUBLIC_DIR, 'favicon-16.png'));

  // 32x32 Favicon (from high-contrast favSvg)
  await renderSvgToPng(page, favSvgContent, 32, path.join(PUBLIC_DIR, 'favicon-32.png'));

  // 180x180 Apple Touch Icon (from main logo.svg)
  await renderSvgToPng(page, svgContent, 180, path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // 192x192 PWA Icon
  await renderSvgToPng(page, svgContent, 192, path.join(PUBLIC_DIR, 'icon-192.png'));

  // 512x512 PWA Icon
  await renderSvgToPng(page, svgContent, 512, path.join(PUBLIC_DIR, 'icon-512.png'));

  await browser.close();
  console.log('All favicon & logo PNG assets successfully generated!');
}

main().catch(console.error);
