import menuData from '../data/reconciled-menu.json';
import { Product, MenuCategoryGroup } from '../types';
import { resolveProductImage } from './productImageMap';

export interface RegularCategory {
  id: string;
  label: string;
  subtitle: string;
}

/**
 * 32 AUTHORITATIVE REGULAR MENU CATEGORIES
 * Verified against Little Monkey Café authoritative localMenuCatalog.
 * 'thin-crust-pizza' and 'pizza-combos' are strictly separated.
 */
export const REGULAR_CATEGORIES: RegularCategory[] = [
  { id: 'all', label: 'All Items', subtitle: 'Full café catalog' },
  { id: 'thin-crust-pizza', label: 'Pizzas', subtitle: '11" • 8 Slices' },
  { id: 'pizza-combos', label: 'Pizza Combos', subtitle: 'Pizza + Sides Combos' },
  { id: 'pasta', label: 'Pasta', subtitle: 'Custom Sauce & Pasta Choice' },
  { id: 'sandwiches', label: 'Sandwiches', subtitle: 'Fresh Grilled Breads' },
  { id: 'shawarma', label: 'Shawarma', subtitle: 'Authentic Toum Rolls' },
  { id: 'fries', label: 'Fries', subtitle: 'Handcut & Seasoned' },
  { id: 'burgers', label: 'Burgers', subtitle: 'Gourmet Handmade Patties' },
  { id: 'burger-combos', label: 'Burger Combos', subtitle: 'Burger + Sides Combos' },
  { id: 'garlic-bread', label: 'Garlic Bread', subtitle: 'Warm Herb Breads' },
  { id: 'sides-quick-bites', label: 'Sides Quick Bites', subtitle: 'Bites & Starters' },
  { id: 'desserts', label: 'Desserts', subtitle: 'Brownies & Sweets' },
  { id: 'crispy-chicken', label: 'Crispy Chicken', subtitle: 'Wings, Nuggets & Popcorn' },
  { id: 'crispy-fish', label: 'Crispy Fish', subtitle: 'Fingers & Prawns' },
  { id: 'combos', label: 'Combos', subtitle: 'Value Café Pairings' },
  { id: 'healthy-bowls', label: 'Healthy Bowls', subtitle: 'Quinoa & Rice Bowls' },
  { id: 'salads', label: 'Salads', subtitle: 'Fresh Half & Full Bowls' },
  { id: 'milkshakes', label: 'Milkshakes', subtitle: 'Classic Chilled Shakes' },
  { id: 'cold-coffee', label: 'Cold Coffee', subtitle: 'Frappes & Iced Brews' },
  { id: 'mojito', label: 'Mojito', subtitle: 'Sparkling Mint Mojitos' },
  { id: 'thick-shakes', label: 'Thick Shakes', subtitle: 'Gourmet Thick Shakes' },
  { id: 'boba-tea-coffee', label: 'Boba Tea Coffee', subtitle: 'Authentic Boba Pearls' },
  { id: 'momos', label: 'Momos', subtitle: 'Steamed & Savory' },
  { id: 'ice-creams', label: 'Ice Creams', subtitle: 'Rich Chilled Scoops' },
  { id: 'hot-coffee', label: 'Hot Coffee', subtitle: 'Artisanal Espresso Brews' },
  { id: 'signature-coffee', label: 'Signature Coffee', subtitle: 'House Signature Specials' },
  { id: 'iced-coffee', label: 'Iced Coffee', subtitle: 'Chilled Espresso' },
  { id: 'iced-tea', label: 'Iced Tea', subtitle: 'Refreshing Cold Brew Teas' },
  { id: 'green-tea', label: 'Green Tea', subtitle: 'Soothing Infusions' },
  { id: 'special-green-tea-pot', label: 'Special Green Tea Pot', subtitle: 'Wellness Tea Pots' },
];

// Backwards-compatible export for any components expecting MenuCategoryGroup[]
export const CATEGORY_GROUPS: MenuCategoryGroup[] = REGULAR_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  categories: c.id === 'all' ? [] : [c.id],
}));

export function cleanCustomerDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .replace(/•?\s*Source note:.*$/i, '')
    .replace(/•?\s*Note:.*$/i, '')
    .replace(/as extracted;?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PROMOTIONAL CRAFT COLD BREW SIGNATURE COLLECTION
 * Artwork: "Craft Meets Cold — The Ice Side of Coffee" (10 Signature Cold Brews)
 * Kept strictly separate from the 32 regular menu categories.
 */
export const SPECIALTY_COLD_BREW_PRODUCTS: Product[] = [
  {
    slug: 'cold-brew-tiger-bomb',
    category: 'cold-brew',
    name: 'Tiger Bomb Cold Brew',
    description:
      'A sensory and visual showstopper: concentrated slow-steeped cold brew marbled through velvety sweet cream and condensed milk over crystal ice. Signature tiger-stripe cascade creates a luscious, dessert-like coffee experience.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 289,
    discount_percent: 14,
    tagline: 'Marbled • Velvety • Intense',
    badge: 'Café Signature',
    image_url: '/images/cold-brew/tiger-bomb.png',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 28900,
      },
    ],
    ingredients: [
      { name: 'Concentrated Cold Brew', detail: 'Signature dark roast slow-steeped for 18 hours' },
      { name: 'Velvety Sweet Cream', detail: 'Chilled rich dairy cream cascade' },
      { name: 'Condensed Milk Swirl', detail: 'Artisanal sweet drizzle forming tiger stripes' },
      { name: 'Roasted Coffee Beans', detail: 'Crisp aromatic whole bean garnish' },
    ],
    process_steps: [
      '18-Hour Coarse-Ground Cold Maceration',
      'Double Micro-Mesh Filtration',
      'Signature Gravity Cascade Marbling',
    ],
  },
  {
    slug: 'cold-brew-mont-blanc',
    category: 'cold-brew',
    name: 'Mont Blanc Cold Brew',
    description:
      'Inspired by alpine peaks: 18-hour slow-steeped cold brew crowned with an airy, cloud-like sweet vanilla cold foam and a fine dust of raw cocoa and cinnamon.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 349,
    discount_percent: 14,
    tagline: 'Silky • Cloud Foam • Decadent',
    badge: 'Alpine Reserve',
    image_url: '/images/products/ice_coffee_1.jpg',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 29900,
        original_price_paise: 34900,
      },
    ],
    ingredients: [
      { name: 'Slow-Drip Cold Brew', detail: '100% Arabica washed beans' },
      { name: 'Vanilla Velvet Cold Foam', detail: 'Hand-frothed chilled sweet milk cap' },
      { name: 'Raw Cocoa & Cinnamon', detail: 'Micro-planed aromatic dusting' },
    ],
    process_steps: [
      'Cold Extraction at 4°C',
      'Aerated High-Velocity Cold Foam Whisk',
      'Gentle Float Assembly',
    ],
  },
  {
    slug: 'cold-brew-classic',
    category: 'cold-brew',
    name: 'Classic Cold Brew',
    description:
      'Pure, unadorned perfection. Handcrafted 18-hour cold brew brewed with 100% Arabica estate beans, delivering deep notes of dark chocolate, toasted nuts, and zero acidity.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 249,
    discount_percent: 20,
    tagline: 'Bold • Chocolatey • Pure',
    badge: 'The Classic',
    image_url: '/images/cold-brew/cold-brew-hero-wide.png',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 19900,
        original_price_paise: 24900,
      },
    ],
    ingredients: [
      { name: 'Single-Estate Arabica', detail: 'Chikmagalur medium-dark artisanal roast' },
      { name: 'Mountain Spring Water', detail: 'Neutral mineral water for clean finish' },
    ],
    process_steps: [
      '18-Hour Immersive Cold Steep',
      'Triple-Stage Paper & Mesh Filtration',
      'Flash-Chilled Nitrogen Preservation',
    ],
  },
  {
    slug: 'cold-brew-ginger-ale',
    category: 'cold-brew',
    name: 'Ginger Ale Cold Brew',
    description:
      'A fiery and effervescent union of artisan ginger ale soda layered with cold-extracted coffee. Spiced, bubbly, and invigorating.',
    dietary_classification: 'VEG',
    is_must_try: false,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Spiced • Bubbly • Vibrant',
    badge: 'Sparkling Brew',
    image_url: '/images/cold-brew/espresso-orange-delight.png',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
  },
  {
    slug: 'cold-brew-honey-cinnamon',
    category: 'cold-brew',
    name: 'Honey Cinnamon Cold Brew',
    description:
      'Organic wild forest honey and freshly ground Ceylon cinnamon gently infused into smooth cold-extracted Arabica over crystal ice.',
    dietary_classification: 'VEG',
    is_must_try: false,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Warm Spice • Honey Sweet • Balanced',
    badge: 'Botanical Reserve',
    image_url: '/images/products/boba_coffee_2.jpg',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
  },
  {
    slug: 'cold-brew-passion-fruit',
    category: 'cold-brew',
    name: 'Passion Fruit Cold Brew',
    description:
      'Exotic tropical passion fruit pulp and crunchy seeds in sparkling botanical tonic, crowned with deep dark cold brew and fresh garden mint.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Tropical • Zesty • Botanical',
    badge: 'Seasonal Reserve',
    image_url: '/images/cold-brew/passion-fruit-cold-brew.png',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
    ingredients: [
      { name: 'Dark Roast Cold Brew', detail: 'Smooth cold-extracted Arabica coffee' },
      { name: 'Real Passion Fruit Pulp', detail: 'Golden tropical pulp with edible crunchy seeds' },
      { name: 'Sparkling Tonic Water', detail: 'Effervescent botanical tonic with light bubbles' },
      { name: 'Fresh Garden Mint', detail: 'Hand-clapped fragrant garden mint sprig' },
    ],
    process_steps: [
      'Cold Arabica Drip Extraction',
      'Tropical Fruit Pulp Muddle',
      'Effervescent Tonic & Mint Finish',
    ],
  },
  {
    slug: 'cold-brew-espresso-orange',
    category: 'cold-brew',
    name: 'Espresso Orange',
    description:
      'Handcrafted specialty cold brew layered with bright citrus tonic, refreshing Valencia orange nectar, and crowned with rich, bold espresso. Served over crystal ice with a fresh orange wheel.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Bold • Citrusy • Refreshing',
    badge: 'Specialty Cold Brew',
    image_url: '/images/cold-brew/espresso-orange.png',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
    ingredients: [
      { name: 'Top Layer: Rich Espresso', detail: 'Single-origin espresso roast, dark, rich & bold' },
      { name: 'Middle Layer: Orange Infusion', detail: 'Natural Valencia orange nectar essence' },
      { name: 'Base Layer: Citrus Tonic Base', detail: 'Crisp botanical sparkling citrus base' },
      { name: 'Garnish: Fresh Orange', detail: 'Hand-sliced sweet orange wheel over crystal ice' },
    ],
    process_steps: [
      '16-Hour Slow Cold Water Drip',
      'Artisanal Citrus & Botanical Infusion',
      'Precision Dual-Density Floating Pour',
    ],
  },
  {
    slug: 'cold-brew-tonic-espresso',
    category: 'cold-brew',
    name: 'Tonic Espresso',
    description:
      'Crisp premium tonic water served on ice, gently topped with a freshly pulled double shot of single-origin espresso. A bright, sparkling botanical contrast.',
    dietary_classification: 'VEG',
    is_must_try: false,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Effervescent • Bitter-Sweet • Sharp',
    badge: 'Sparkling Espresso',
    image_url: '/images/products/espresso_2.jpg',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
  },
  {
    slug: 'cold-brew-tiramisu',
    category: 'cold-brew',
    name: 'Tiramisu Cold Coffee',
    description:
      'The classic Italian dessert in a glass: rich cold brew layered with mascarpone cream, savoiardi biscuit crumble, and dusted with Belgian dark cocoa.',
    dietary_classification: 'VEG',
    is_must_try: true,
    is_available: true,
    original_price: 399,
    discount_percent: 13,
    tagline: 'Dessert-Crafted • Rich • Indulgent',
    badge: 'Gourmet Cold Coffee',
    image_url: '/images/products/boba_coffee_4_.jpg',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 34900,
        original_price_paise: 39900,
      },
    ],
  },
  {
    slug: 'cold-brew-ginger-ale-espresso',
    category: 'cold-brew',
    name: 'Ginger Ale Espresso',
    description:
      'Bold dark roast espresso poured over chilled sparkling ginger ale and ice. Spicy ginger notes harmonize with dark roasted caramel undertones.',
    dietary_classification: 'VEG',
    is_must_try: false,
    is_available: true,
    original_price: 299,
    discount_percent: 17,
    tagline: 'Zesty • Sparkling • Punchy',
    badge: 'Craft Fusion',
    image_url: '/images/products/espresso_3.jpg',
    variants: [
      {
        name: 'Regular (350ml)',
        price_paise: 24900,
        original_price_paise: 29900,
      },
    ],
  },
];

/**
 * Reconciled catalog products with verified client photography mapped automatically.
 */
const reconciledProducts: Product[] = (menuData.products as Product[]).map((p) => {
  const resolvedImg = resolveProductImage(p);
  return {
    ...p,
    is_available: p.is_available !== false,
    image_url: resolvedImg || p.image_url || null,
    description: cleanCustomerDescription(p.description),
    variants:
      p.variants && p.variants.length > 0
        ? p.variants
        : p.is_price_unclear
        ? [{ name: 'Price to be verified', price_paise: 0 }]
        : [{ name: 'Regular', price_paise: 19900 }],
  };
});

export const ALL_PRODUCTS: Product[] = [
  ...SPECIALTY_COLD_BREW_PRODUCTS,
  ...reconciledProducts,
];

export function getMustTryProducts(): Product[] {
  return ALL_PRODUCTS.filter((p) => p.is_must_try);
}

/**
 * Filter products cleanly and strictly.
 * When categoryId === 'thin-crust-pizza', only pizzas are returned.
 * When categoryId === 'pizza-combos', only pizza combos are returned.
 * Absolutely no cross-contamination between categories.
 */
export function filterProducts(
  categoryId: string,
  dietFilter: 'ALL' | 'VEG' | 'NON_VEG',
  searchQuery: string = '',
  productList: Product[] = ALL_PRODUCTS
): Product[] {
  const query = searchQuery.trim().toLowerCase();

  return productList.filter((p) => {
    // 1. Category filtering
    if (categoryId && categoryId !== 'all') {
      if (p.category !== categoryId) return false;
    }

    // 2. Diet filtering
    if (dietFilter !== 'ALL') {
      if (dietFilter === 'VEG' && p.dietary_classification !== 'VEG') return false;
      if (dietFilter === 'NON_VEG' && p.dietary_classification !== 'NON_VEG' && p.dietary_classification !== 'EGG') return false;
    }

    // 3. Search query
    if (query) {
      const matchName = (p.name || '').toLowerCase().includes(query);
      const matchDesc = (p.description || '').toLowerCase().includes(query);
      const matchCat = (p.category || '').toLowerCase().includes(query);
      if (!matchName && !matchDesc && !matchCat) return false;
    }

    return true;
  });
}

export interface CatalogStatus {
  isStoreOpen: boolean;
  isDineInOpen: boolean;
  discounts: Record<string, number>;
  liveAvailability: Record<string, boolean>;
  liveImages?: Record<string, string>;
}

export async function fetchCatalogStatus(): Promise<CatalogStatus | null> {
  try {
    const res = await fetch('/api/dine-in/products');
    if (res.ok) {
      const data = await res.json();
      return {
        isStoreOpen: data.isStoreOpen !== false,
        isDineInOpen: data.isDineInOpen !== false,
        discounts: data.discounts || {},
        liveAvailability: data.liveAvailability || {},
        liveImages: data.liveImages || {},
      };
    }
  } catch (err) {
    console.warn('[catalog] Error fetching live catalog status:', err);
  }
  return null;
}

export function applyLiveUpdates(
  products: Product[],
  status: CatalogStatus | null
): Product[] {
  if (!status) return products;
  const { discounts, liveAvailability, liveImages = {} } = status;

  return products.map((p) => {
    const updated = { ...p };
    // 1. Stock availability
    if (liveAvailability[p.slug] !== undefined) {
      updated.is_available = liveAvailability[p.slug];
    } else if (p.id && liveAvailability[p.id] !== undefined) {
      updated.is_available = liveAvailability[p.id];
    } else if (p.name && liveAvailability[p.name.toLowerCase().trim()] !== undefined) {
      updated.is_available = liveAvailability[p.name.toLowerCase().trim()];
    }

    // 2. Authoritative live image updates from Admin Portal / Supabase
    if (liveImages[p.slug]) {
      updated.image_url = liveImages[p.slug];
    } else if (p.id && liveImages[p.id]) {
      updated.image_url = liveImages[p.id];
    }

    // 3. Authoritative discounts
    if (discounts[p.slug] !== undefined && typeof discounts[p.slug] === 'number') {
      const discPaise = discounts[p.slug];
      const origPaise = p.variants[0]?.price_paise || discPaise;
      updated.variants = p.variants.map((v, idx) => {
        if (idx === 0) {
          return {
            ...v,
            price_paise: discPaise,
            original_price_paise: v.original_price_paise || origPaise,
          };
        }
        return v;
      });
      const discRupees = Math.round(discPaise / 100);
      const origRupees = Math.round(origPaise / 100);
      if (origRupees > discRupees) {
        updated.original_price = origRupees;
        updated.discount_percent = Math.round(((origRupees - discRupees) / origRupees) * 100);
      }
    }

    return updated;
  });
}

export function getBasePrice(product: Product): number | null {
  if (product.is_price_unclear) return null;
  if (!product.variants || product.variants.length === 0) return null;
  const price = product.variants[0].price_paise;
  if (typeof price !== 'number' || isNaN(price) || price <= 0) return null;
  return Math.round(price / 100);
}

export function getOriginalPrice(product: Product): number | null {
  if (product.original_price && product.original_price > 0) {
    return product.original_price;
  }
  if (product.variants && product.variants.length > 0) {
    const origPaise = product.variants[0].original_price_paise;
    if (typeof origPaise === 'number' && origPaise > 0) {
      return Math.round(origPaise / 100);
    }
  }
  return null;
}

export function getDiscountPercentage(product: Product): number | null {
  if (product.discount_percent && product.discount_percent > 0) {
    return product.discount_percent;
  }
  const base = getBasePrice(product);
  const orig = getOriginalPrice(product);
  if (base && orig && orig > base) {
    return Math.round(((orig - base) / orig) * 100);
  }
  return null;
}
