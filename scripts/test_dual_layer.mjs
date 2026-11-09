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
  body { background: #080808; color: #fff; font-family: "Plus Jakarta Sans", system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 20px; color: #FFC21A; margin-bottom: 20px; }
  .section-title { font-size: 16px; color: #E5AC14; margin: 30px 0 14px 0; border-bottom: 1px solid #242424; padding-bottom: 6px; }
  
  /* GRID FOR CARDS */
  .card-grid { display: grid; grid-template-columns: repeat(3, 260px); gap: 18px; margin-bottom: 30px; }
  .card { background: #111; border: 1px solid #242424; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
  .card-img-wrap { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; background: #080808; }
  .card-img-wrap .bg-ambient { position: absolute; inset: -15px; width: calc(100% + 30px); height: calc(100% + 30px); object-fit: cover; filter: blur(28px) brightness(0.65) saturate(1.3); pointer-events: none; }
  .card-img-wrap .main-img { position: relative; z-index: 2; width: 100%; height: 100%; display: block; }
  .card-info { padding: 12px; }
  .card-info h3 { margin: 0 0 4px 0; font-size: 13.5px; color: #F5F5F5; }
  .card-info p { margin: 0 0 8px 0; font-size: 11px; color: #888; }
  .card-info .price { font-size: 15px; font-weight: 800; color: #FFC21A; }
  
  /* MODAL PREVIEWS */
  .modal-grid { display: grid; grid-template-columns: repeat(2, 480px); gap: 24px; }
  .modal-box { background: #080808; border: 1px solid #242424; border-radius: 14px; overflow: hidden; }
  .modal-header { padding: 10px 18px; background: #0A0A0A; border-bottom: 1px solid #1E1E1E; display: flex; justify-content: space-between; align-items: center; }
  .modal-header span { font-size: 12px; font-weight: bold; color: #FFC21A; letter-spacing: 0.05em; text-transform: uppercase; }
  .modal-stage { position: relative; width: 100%; height: 280px; overflow: hidden; background: #050505; }
  .modal-stage .bg-ambient { position: absolute; inset: -20px; width: calc(100% + 40px); height: calc(100% + 40px); object-fit: cover; filter: blur(32px) brightness(0.6) saturate(1.3); pointer-events: none; }
  .modal-stage .main-img { position: relative; z-index: 2; width: 100%; height: 100%; display: block; }
  .modal-content { padding: 16px 20px; }
  .modal-content h2 { margin: 0 0 6px 0; font-size: 18px; color: #FFF; }
  .modal-content .tagline { font-size: 12px; color: #FFC21A; font-weight: 700; margin-bottom: 8px; }
  .modal-content .price { font-size: 20px; font-weight: 800; color: #FFC21A; }
</style>
</head>
<body>
  <h1>Proposed Dual-Layer & Smart Focal Image Architecture</h1>
  
  <div class="section-title">Part A: Menu Item Cards (ProductCard) - Zero Black Bars</div>
  <div class="card-grid">
    <!-- Card 1: Spicy Mexican Pizza (Portrait: center 22%) -->
    <div class="card">
      <div class="card-img-wrap">
        <img class="bg-ambient" src="http://127.0.0.1:3000/images/products/farmhouse4.jpg" />
        <img class="main-img" src="http://127.0.0.1:3000/images/products/farmhouse4.jpg" style="object-fit: cover; object-position: center 22%;" />
      </div>
      <div class="card-info">
        <h3>Spicy Mexican Pizza</h3>
        <p>11" Thin Crust • 8 Slices</p>
        <span class="price">₹375</span>
      </div>
    </div>

    <!-- Card 2: Crispy Chicken Burger (Portrait: center 75%) -->
    <div class="card">
      <div class="card-img-wrap">
        <img class="bg-ambient" src="http://127.0.0.1:3000/images/products/chicken_burger_1.jpg" />
        <img class="main-img" src="http://127.0.0.1:3000/images/products/chicken_burger_1.jpg" style="object-fit: cover; object-position: center 75%;" />
      </div>
      <div class="card-info">
        <h3>Crispy Chicken Burger</h3>
        <p>Gourmet Handmade Patties</p>
        <span class="price">₹185</span>
      </div>
    </div>

    <!-- Card 3: Tiger Bomb Cold Brew (Cutout / Ambient Pedestal) -->
    <div class="card">
      <div class="card-img-wrap">
        <img class="bg-ambient" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" />
        <img class="main-img" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" style="object-fit: contain; padding: 10px; box-sizing: border-box; filter: drop-shadow(0 8px 18px rgba(0,0,0,0.8));" />
      </div>
      <div class="card-info">
        <h3>Tiger Bomb Cold Brew</h3>
        <p>Marbled • Velvety • Intense</p>
        <span class="price">₹234</span>
      </div>
    </div>
  </div>

  <div class="section-title">Part B: Product Details Modal - Zero Black Bars Across Food & Drinks</div>
  <div class="modal-grid">
    <!-- Modal 1: Spicy Mexican Pizza -->
    <div class="modal-box">
      <div class="modal-header">
        <span>Product Details • Thin Crust Pizza</span>
        <span style="color: #666; font-size: 14px;">✕</span>
      </div>
      <div class="modal-stage">
        <img class="bg-ambient" src="http://127.0.0.1:3000/images/products/farmhouse4.jpg" />
        <img class="main-img" src="http://127.0.0.1:3000/images/products/farmhouse4.jpg" style="object-fit: cover; object-position: center 22%;" />
      </div>
      <div class="modal-content">
        <h2>Spicy Mexican Pizza</h2>
        <div class="tagline">ONION, CAPSICUM, CHILLI FLAKES • 11 inch, 8 slices</div>
        <div class="price">₹375</div>
      </div>
    </div>

    <!-- Modal 2: Tiger Bomb Cold Brew (Uncropped with Ambient Backdrop) -->
    <div class="modal-box">
      <div class="modal-header">
        <span>Product Details • Cold Brew</span>
        <span style="color: #666; font-size: 14px;">✕</span>
      </div>
      <div class="modal-stage">
        <img class="bg-ambient" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" />
        <img class="main-img" src="http://127.0.0.1:3000/images/cold-brew/tiger-bomb.png" style="object-fit: contain; padding: 12px; box-sizing: border-box; filter: drop-shadow(0 14px 28px rgba(0,0,0,0.9));" />
      </div>
      <div class="modal-content">
        <h2>Tiger Bomb Cold Brew</h2>
        <div class="tagline">MARBLED • VELVETY • INTENSE</div>
        <div class="price">₹234</div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('test_artifacts/test_dual_layer.html', testHtml);

async function render() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1100 });
  const fullPath = path.resolve('test_artifacts/test_dual_layer.html').replace(/\\/g, '/');
  await page.goto(`file:///${fullPath}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'test_artifacts/dual_layer_preview.png', fullPage: true });
  await browser.close();
  console.log('Dual layer preview captured: test_artifacts/dual_layer_preview.png');
}

render().catch(console.error);
