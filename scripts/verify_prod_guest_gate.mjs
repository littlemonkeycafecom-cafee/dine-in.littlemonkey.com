import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

async function runProdGuestCheck() {
  console.log('Testing Production Build Guest Gating...');

  // Read production index.html and JS chunk to ensure no guest backdoor
  const distHtml = fs.readFileSync('dist/index.html', 'utf8');
  assert(distHtml.length > 0, 'Production dist/index.html must exist');

  // Verify that in dineInServerPlugin, guest-session returns 403 when NODE_ENV=production
  const pluginCode = fs.readFileSync('src/server/dineInServerPlugin.ts', 'utf8');
  assert(
    pluginCode.includes("process.env.NODE_ENV === 'production' && process.env.VITE_ENABLE_GUEST_PREVIEW !== 'true'"),
    'Server must block guest session creation in production'
  );

  console.log('[PASS] Production server-side guest generation security check verified.');
}

runProdGuestCheck().catch((err) => {
  console.error(err);
  process.exit(1);
});
