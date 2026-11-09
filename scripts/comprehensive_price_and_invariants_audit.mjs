import fs from 'node:fs';
import { strict as assert } from 'node:assert';

console.log('========================================================================');
console.log('LITTLE MONKEY CAFÉ — COMPREHENSIVE PRICE & INVARIANTS AUDIT');
console.log('========================================================================\n');

const baseline = JSON.parse(fs.readFileSync('docs/PRE_CHANGE_PRICE_BASELINE.json', 'utf8'));
const currentMenu = JSON.parse(fs.readFileSync('src/data/reconciled-menu.json', 'utf8'));
const catalogSrc = fs.readFileSync('src/services/catalog.ts', 'utf8');

// 1. Extract Specialty Cold Brew prices from catalog.ts
const startIdx = catalogSrc.indexOf('SPECIALTY_COLD_BREW_PRODUCTS: Product[] = [');
const endIdx = catalogSrc.indexOf('const reconciledProducts: Product[]');
const block = catalogSrc.slice(startIdx, endIdx);

const coldBrews = {};
const regex = /\{\s*slug:\s*'([^']+)',[\s\S]*?name:\s*'([^']+)',[\s\S]*?price_paise:\s*(\d+)/g;
let m;
while ((m = regex.exec(block)) !== null) {
  coldBrews[m[1]] = parseInt(m[3], 10) / 100;
}

// 2. Build current menu price map
const menuMap = {};
currentMenu.products.forEach((p) => {
  menuMap[p.slug] = p.variants[0].price_paise / 100;
});

// ----------------------------------------------------------------------
// REQUIREMENT 4: All regular product prices follow authorized ₹15 reduction
// ----------------------------------------------------------------------
console.log('--- REQUIREMENT 4: Regular Product Prices (₹15 Reduction) ---');
let regularPass = 0;
let regularFail = 0;
const regularFailures = [];

baseline.regularItems.forEach((item) => {
  const currentPrice = item.source === 'SPECIALTY_COLD_BREW_PRODUCTS' ? coldBrews[item.slug] : menuMap[item.slug];
  const expectedPrice = item.base_price_inr - 15;
  const diff = currentPrice - item.base_price_inr;
  if (diff === -15 && currentPrice === expectedPrice) {
    regularPass++;
  } else {
    regularFail++;
    regularFailures.push({ name: item.name, slug: item.slug, baseline: item.base_price_inr, current: currentPrice, diff });
  }
});

console.log(`  Total regular items checked: ${baseline.regularItems.length}`);
console.log(`  Passed (exact -₹15 reduction): ${regularPass}`);
console.log(`  Failed: ${regularFail}`);
if (regularFailures.length > 0) {
  console.error('  Failures:', regularFailures);
}
assert.strictEqual(regularFail, 0, 'Every eligible regular item must have exact ₹15 reduction');
assert.strictEqual(regularPass, 176, 'Exactly 176 regular items must pass');

// ----------------------------------------------------------------------
// REQUIREMENT 5: Spicy Mexican Pizza is ₹375 (Original: ₹390)
// ----------------------------------------------------------------------
console.log('\n--- REQUIREMENT 5: Spicy Mexican Pizza Price Verification ---');
const spicyMexicanBaseline = baseline.regularItems.find((i) => i.slug === 'thin-crust-pizza-spicy-mexican-pizza');
const spicyMexicanCurrent = menuMap['thin-crust-pizza-spicy-mexican-pizza'];
console.log(`  Baseline original price: ₹${spicyMexicanBaseline.base_price_inr}`);
console.log(`  Current menu price: ₹${spicyMexicanCurrent}`);
console.log(`  Calculated reduction: ₹${spicyMexicanBaseline.base_price_inr} - ₹${spicyMexicanCurrent} = ₹${spicyMexicanBaseline.base_price_inr - spicyMexicanCurrent}`);
assert.strictEqual(spicyMexicanBaseline.base_price_inr, 390, 'Spicy Mexican Pizza original price must be ₹390');
assert.strictEqual(spicyMexicanCurrent, 375, 'Spicy Mexican Pizza current price must be ₹375');
assert.strictEqual(spicyMexicanBaseline.base_price_inr - spicyMexicanCurrent, 15, 'Reduction must be exactly ₹15');
console.log('  [PASS] Spicy Mexican Pizza is verified at ₹375.');

// ----------------------------------------------------------------------
// REQUIREMENT 6: Extra dips, add-ons, sauces, toppings unchanged
// ----------------------------------------------------------------------
console.log('\n--- REQUIREMENT 6: Extra Dips & Add-ons Invariants (₹0 Change) ---');
let dipPass = 0;
let dipFail = 0;
const dipFailures = [];

baseline.dips.forEach((item) => {
  const currentPrice = menuMap[item.slug];
  const diff = currentPrice - item.base_price_inr;
  if (diff === 0 && currentPrice === item.base_price_inr) {
    dipPass++;
    console.log(`  Dip: ${item.name} -> Baseline: ₹${item.base_price_inr}, Current: ₹${currentPrice} (Change: ₹0) [PASS]`);
  } else {
    dipFail++;
    dipFailures.push({ name: item.name, slug: item.slug, baseline: item.base_price_inr, current: currentPrice, diff });
  }
});
assert.strictEqual(dipFail, 0, 'All extra dips must remain completely unchanged');

let addonPass = 0;
let addonFail = 0;
const addonFailures = [];

baseline.addons.forEach((item) => {
  const currentPrice = menuMap[item.slug];
  const diff = currentPrice - item.base_price_inr;
  if (diff === 0 && currentPrice === item.base_price_inr) {
    addonPass++;
  } else {
    addonFail++;
    addonFailures.push({ name: item.name, slug: item.slug, baseline: item.base_price_inr, current: currentPrice, diff });
  }
});
console.log(`  Total add-ons checked: ${baseline.addons.length}`);
console.log(`  Passed (exact ₹0 change): ${addonPass}`);
console.log(`  Failed: ${addonFail}`);
assert.strictEqual(addonFail, 0, 'All add-ons must remain completely unchanged');

// ----------------------------------------------------------------------
// REQUIREMENT 7: Exactly two intended master items in featured section
// ----------------------------------------------------------------------
console.log('\n--- REQUIREMENT 7: Exactly Two Master Items in Featured Section ---');
const mustTryRailSrc = fs.readFileSync('src/components/MustTryRail.tsx', 'utf8');
const targetMasterMatch = mustTryRailSrc.match(/const TARGET_MASTER_SLUGS = \[([^\]]+)\]/);
assert.ok(targetMasterMatch, 'TARGET_MASTER_SLUGS must be defined in MustTryRail.tsx');

const slugs = targetMasterMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/['"]/g, ''))
  .filter(Boolean);

console.log('  Master slugs configured in MustTryRail:', slugs);
assert.strictEqual(slugs.length, 2, 'Exactly 2 master slugs must be configured');
assert.strictEqual(slugs[0], 'cold-brew-tiger-bomb', 'First master item must be cold-brew-tiger-bomb');
assert.strictEqual(slugs[1], 'cold-brew-mont-blanc', 'Second master item must be cold-brew-mont-blanc');

console.log(`  Master Item 1: "The Tiger Bomb" (slug: ${slugs[0]}) -> Price: ₹${coldBrews[slugs[0]]}`);
console.log(`  Master Item 2: "Mont Blanc" (slug: ${slugs[1]}) -> Price: ₹${coldBrews[slugs[1]]}`);
assert.strictEqual(coldBrews[slugs[0]], 234, 'Tiger Bomb price must be ₹234 (249 - 15)');
assert.strictEqual(coldBrews[slugs[1]], 284, 'Mont Blanc price must be ₹284 (299 - 15)');
console.log('  [PASS] Exactly the two intended master items are configured with correct reduced prices.');

console.log('\n========================================================================');
console.log('ALL PRICE & INVARIANT AUDIT ASSERTIONS PASSED WITH ZERO DISCREPANCIES');
console.log('========================================================================');
