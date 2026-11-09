import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const testHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { background: #000; color: #fff; font-family: sans-serif; padding: 20px; }
  .grid { display: flex; flex-wrap: wrap; gap: 20px; }
  .modal-box { width: 480px; background: #080808; border: 1px solid #242424; border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
  .title { padding: 10px 16px; font-size: 13px; color: #FFC21A; font-weight: bold; background: #0A0A0A; border-bottom: 1px solid #1E1E1E; }
  
  .stage-cover { position: relative; width: 100%; height: 280px; overflow: hidden; }
  .stage-cover img { width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }

  .stage-ambient { position: relative; width: 100%; height: 280px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .stage-ambient .bg-blur { position: absolute; inset: -20px; width: calc(100% + 40px); height: calc(100% + 40px); object-fit: cover; filter: blur(35px) brightness(0.65) saturate(1.4); }
  .stage-ambient .fg-img { position: relative; z-index: 2; height: 100%; max-width: 100%; object-fit: contain; padding: 10px; box-sizing: border-box; filter: drop-shadow(0 14px 28px rgba(0,0,0,0.9)); }
</style>
</head>
<body>
  <h1>Drink Presentation: Cover vs Ambient Blur</h1>
  <div class="grid">
    <div class="modal-box">
      <div class="title">Drink Option A: object-fit cover (center 30%)</div>
      <div class="stage-cover">
        <img src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" />
      </div>
    </div>
    <div class="modal-box">
      <div class="title">Drink Option B: Ambient Blur Backdrop (Zero Black Bars)</div>
      <div class="stage-ambient">
        <img class="bg-blur" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" />
        <img class="fg-img" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" />
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('test_artifacts/test_drink.html', testHtml);

async function render() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 600 });
  const fullPath = path.resolve('test_artifacts/test_drink.html').replace(/\\/g, '/');
  await page.goto(`file:///${fullPath}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'test_artifacts/drink_compare.png', fullPage: true });
  await browser.close();
  console.log('Drink compare screenshot captured: test_artifacts/drink_compare.png');
}

render().catch(console.error);
