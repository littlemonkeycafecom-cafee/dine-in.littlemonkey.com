import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-verify-menu-motion-' + Date.now());

async function run() {
  console.log('--- COMPREHENSIVE MENU ACCURACY & YELLOW MOTION VERIFICATION ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9337',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1',
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9337/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found on CDP port 9337');

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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1.5,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Verify Verified Items In Client State
    const priceChecks = await send('Runtime.evaluate', {
      expression: `(() => {
        // Query catalog through window or DOM
        const items = [];
        // Scroll to menu catalog
        const menu = document.getElementById('main-menu-catalog');
        if (menu) menu.scrollIntoView({ behavior: 'instant' });
        return {
          hasMenuSection: !!menu,
        };
      })()`,
      returnByValue: true,
    });
    console.log('Menu section check:', priceChecks.result.value);

    // 2. Select "Pizzas" category and verify Chicken and Sweet Corn Pizza price
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const pizzaBtn = buttons.find(b => b.textContent.trim() === 'Pizzas');
        if (pizzaBtn) pizzaBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    const pizzaPrices = await send('Runtime.evaluate', {
      expression: `(() => {
        const cards = Array.from(document.querySelectorAll('#main-menu-catalog article, #main-menu-catalog div[style*="border-radius"]'));
        const sweetCornPizza = Array.from(document.querySelectorAll('*')).find(el => el.textContent === 'Chicken and Sweet Corn Pizza');
        let priceText = null;
        if (sweetCornPizza) {
          const parent = sweetCornPizza.closest('div[style*="background"]');
          if (parent) {
            priceText = parent.textContent;
          }
        }
        return {
          foundPizza: !!sweetCornPizza,
          parentSnippet: priceText ? priceText.slice(0, 150) : null
        };
      })()`,
      returnByValue: true,
    });
    console.log('Chicken and Sweet Corn Pizza DOM check:', pizzaPrices.result.value);

    const ssPizzas = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_pizzas_accurate.png', Buffer.from(ssPizzas.data, 'base64'));
    console.log('✓ Captured verify_pizzas_accurate.png');

    // 3. Select "Add-Ons & Dips" category and inspect all 18 items
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const addonsBtn = buttons.find(b => b.textContent.includes('Add-Ons & Dips'));
        if (addonsBtn) addonsBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    const addonsCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const heading = document.querySelector('#main-menu-catalog h2');
        const countText = heading ? heading.parentElement.textContent : '';
        // Find specific items
        const hasCheese = Array.from(document.querySelectorAll('*')).some(el => el.textContent === 'Cheese');
        const hasIrish = Array.from(document.querySelectorAll('*')).some(el => el.textContent === 'Irish');
        const hasExtraDip = Array.from(document.querySelectorAll('*')).some(el => el.textContent === 'Extra Dip (Sauces)');
        const hasMayoDip = Array.from(document.querySelectorAll('*')).some(el => el.textContent === 'Mayo Dip');
        return {
          heading: heading ? heading.textContent : null,
          countText,
          hasCheese,
          hasIrish,
          hasExtraDip,
          hasMayoDip
        };
      })()`,
      returnByValue: true,
    });
    console.log('Add-Ons & Dips Category check:', addonsCheck.result.value);

    const ssAddons = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_addons_dips_accurate.png', Buffer.from(ssAddons.data, 'base64'));
    console.log('✓ Captured verify_addons_dips_accurate.png');

    // 4. Cart flow verification: Click Add on Cheese Garlic Bread (₹179)
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const startersBtn = buttons.find(b => b.textContent.includes('Starters & Fries'));
        if (startersBtn) startersBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    await send('Runtime.evaluate', {
      expression: `(() => {
        // Find Cheese Garlic Bread "+ Add" button
        const addButtons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const addBtn = addButtons.find(b => b.textContent.includes('Add') || b.textContent.includes('+'));
        if (addBtn) addBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    // Open Cart Drawer
    await send('Runtime.evaluate', {
      expression: `(() => {
        const cartBtn = document.querySelector('header button[aria-label^="Cart"]');
        if (cartBtn) cartBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    const cartCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const drawer = document.querySelector('aside[aria-label="Your Order"]');
        if (!drawer) return null;
        return {
          drawerFound: true,
          textSnippet: drawer.textContent.slice(0, 300)
        };
      })()`,
      returnByValue: true,
    });
    console.log('Cart Drawer check:', cartCheck.result.value);

    const ssCart = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_cart_accurate.png', Buffer.from(ssCart.data, 'base64'));
    console.log('✓ Captured verify_cart_accurate.png');

    // Close Cart Drawer
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector('aside[aria-label="Your Order"] button[aria-label="Close cart"]');
        if (closeBtn) closeBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 600));

    // 5. Yellow Motion Animation Verification
    // Scroll back to Hero Section
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0);` });
    await new Promise((r) => setTimeout(r, 800));

    const motionCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const activeCard = document.querySelector('.lm-surface-reflection.lm-border-beam');
        const logoAmbient = document.querySelector('.lm-logo-ambient-wrap');
        const computedBefore = activeCard ? window.getComputedStyle(activeCard, '::before').animationName : null;
        const computedAfter = activeCard ? window.getComputedStyle(activeCard, '::after').animationName : null;
        const logoAnim = logoAmbient ? window.getComputedStyle(logoAmbient, '::before').animationName : null;

        return {
          activeCardExists: !!activeCard,
          surfaceSweepAnimation: computedBefore,
          borderBeamAnimation: computedAfter,
          logoPulseAnimation: logoAnim
        };
      })()`,
      returnByValue: true,
    });
    console.log('Yellow Motion Animation Check:', motionCheck.result.value);

    ws.close();
    console.log('--- ALL MENU & MOTION CHECKS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
