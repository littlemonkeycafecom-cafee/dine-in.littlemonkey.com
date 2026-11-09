import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

async function createComparison() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 950 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        margin: 0;
        background: #080706;
        color: #fff;
        font-family: sans-serif;
        padding: 20px;
        box-sizing: border-box;
      }
      h2 { margin: 10px 0; font-size: 16px; color: #FFC21A; }
      .box {
        margin-bottom: 24px;
        background: #020202;
        border: 1px solid #222;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 400px;
      }
      img { max-width: 100%; max-height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <h2>1. REFERENCE DESIGN AUTHORITY (media_1794140032077_9f7a6363.jpg)</h2>
    <div class="box">
      <img src="file:///C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/.user_uploaded/media_1794140032077_9f7a6363.jpg" />
    </div>
    <h2>2. RECREATED SVG DOCK PROTOTYPE</h2>
    <div class="box">
      <img src="file:///C:/Users/chava/.gemini/antigravity/scratch/dine-in/scripts/test_dock_refined.png" />
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await page.screenshot({ path: 'scripts/side_by_side_comparison.png' });
  console.log('Saved side_by_side_comparison.png');
  await browser.close();
}

createComparison();
