import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-verify-hero-' + Date.now());

async function run() {
  console.log('--- STARTING HERO & CATEGORIES VERIFICATION ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9335',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1',
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9335/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target found on CDP');
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));

    const callbacks = new Map();
    let msgId = 1;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg.result);
        callbacks.delete(msg.id);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Desktop Test: 1280x860
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 860,
      deviceScaleFactor: 1.5,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify DOM structure:
    const domCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const heroSection = document.querySelector('section');
        const heroLogo = heroSection ? heroSection.querySelector('.lm-logo-ambient-wrap img') : null;
        const heroSearchInput = heroSection ? heroSection.querySelector('input') : null;
        const heroSearchButton = heroSection ? Array.from(heroSection.querySelectorAll('button')).find(b => b.textContent.includes('Search')) : null;
        const categoryBtn = heroSection ? Array.from(heroSection.querySelectorAll('button')).find(b => b.getAttribute('aria-haspopup') === 'listbox') : null;
        const header = document.querySelector('header');
        const headerLogo = header ? header.querySelector('.lm-logo-ambient-wrap img') : null;
        const headerBrandText = header ? header.textContent.includes('Little Monkey Café') : false;
        const headerTableBadge = header ? header.textContent.includes('Table 4') : false;

        return {
          heroExists: !!heroSection,
          heroLogoSrc: heroLogo ? heroLogo.getAttribute('src') : null,
          heroSearchInputExists: !!heroSearchInput,
          heroSearchButtonExists: !!heroSearchButton,
          categoryBtnText: categoryBtn ? categoryBtn.textContent.trim() : null,
          headerLogoExistsInHeader: !!headerLogo,
          headerBrandTextPresent: headerBrandText,
          headerTableBadgePresent: headerTableBadge,
        };
      })()`,
      returnByValue: true,
    });

    console.log('DOM Inspection Results:', JSON.stringify(domCheck.result.value, null, 2));

    // Capture initial Desktop Hero
    const ssDesktop = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_hero_desktop.png', Buffer.from(ssDesktop.data, 'base64'));
    console.log('✓ Captured verify_hero_desktop.png');

    // 2. Open Category Dropdown
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[aria-haspopup="listbox"]');
        if (btn) btn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 600));

    const popoverCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const popover = document.querySelector('[role="listbox"]');
        if (!popover) return null;
        const options = Array.from(popover.querySelectorAll('[role="option"]')).map(o => o.textContent.trim());
        return {
          isOpen: true,
          optionsCount: options.length,
          options,
        };
      })()`,
      returnByValue: true,
    });
    console.log('Category Popover Inspection:', JSON.stringify(popoverCheck.result.value, null, 2));

    const ssPopover = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_category_popover.png', Buffer.from(ssPopover.data, 'base64'));
    console.log('✓ Captured verify_category_popover.png');

    // 3. Click "Pizzas" category in the popover
    await send('Runtime.evaluate', {
      expression: `(() => {
        const popover = document.querySelector('[role="listbox"]');
        if (!popover) return false;
        const pizzaOpt = Array.from(popover.querySelectorAll('[role="option"]')).find(o => o.textContent.includes('Pizzas'));
        if (pizzaOpt) {
          pizzaOpt.click();
          return true;
        }
        return false;
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const pizzaSectionCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const catalogHeading = document.querySelector('#main-menu-catalog h2');
        const categoryBtn = document.querySelector('button[aria-haspopup="listbox"]');
        const popover = document.querySelector('[role="listbox"]');
        return {
          popoverClosed: !popover,
          categoryBtnText: categoryBtn ? categoryBtn.textContent.trim() : null,
          activeCatalogHeading: catalogHeading ? catalogHeading.textContent.trim() : null,
        };
      })()`,
      returnByValue: true,
    });
    console.log('After Category Selection (Pizzas):', JSON.stringify(pizzaSectionCheck.result.value, null, 2));

    const ssPizzas = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_pizzas_selected.png', Buffer.from(ssPizzas.data, 'base64'));
    console.log('✓ Captured verify_pizzas_selected.png');

    // 4. Test Auto-Rotation:
    // Scroll back to top
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0);` });
    await new Promise((r) => setTimeout(r, 800));

    const slideIndex1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const dots = document.querySelectorAll('button[aria-label^="Go to "]');
        return Array.from(dots).findIndex(d => d.style.backgroundColor === 'rgb(251, 195, 36)');
      })()`,
      returnByValue: true,
    });
    console.log('Slide index before wait:', slideIndex1.result.value);

    console.log('Waiting 6.2s for auto-rotation...');
    await new Promise((r) => setTimeout(r, 6200));

    const slideIndex2 = await send('Runtime.evaluate', {
      expression: `(() => {
        const dots = document.querySelectorAll('button[aria-label^="Go to "]');
        return Array.from(dots).findIndex(d => d.style.backgroundColor === 'rgb(251, 195, 36)');
      })()`,
      returnByValue: true,
    });
    console.log('Slide index after wait:', slideIndex2.result.value);

    // 5. Mobile Layout Test: 390x844
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const ssMobile = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_hero_mobile.png', Buffer.from(ssMobile.data, 'base64'));
    console.log('✓ Captured verify_hero_mobile.png');

    ws.close();
    console.log('--- ALL VERIFICATION STEPS FINISHED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

run();
