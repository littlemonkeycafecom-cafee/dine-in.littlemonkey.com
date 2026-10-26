import menuData from '../data/reconciled-menu.json';
import { Product, MenuCategoryGroup } from '../types';

export const CATEGORY_GROUPS: MenuCategoryGroup[] = [
  { id: 'all', label: 'All Items', categories: [] },
  { id: 'cold-brew', label: 'Specialty Cold Brew', categories: ['cold-brew'] },
  { id: 'pizzas', label: 'Pizzas', categories: ['thin-crust-pizza', 'pizza-combos'] },
  { id: 'burgers', label: 'Burgers', categories: ['burgers', 'burger-combos'] },
  {
    id: 'coffee-tea',
    label: 'Coffee & Teas',
    categories: [
      'cold-brew',
      'hot-coffee',
      'cold-coffee',
      'signature-coffee',
      'iced-coffee',
      'iced-tea',
      'green-tea',
      'special-green-tea',
    ],
  },
  {
    id: 'starters-fries',
    label: 'Starters & Fries',
    categories: ['fries', 'starters-sides', 'non-veg-starters'],
  },
  {
    id: 'pasta-shawarma',
    label: 'Shawarma, Pasta & Sandwiches',
    categories: ['pasta', 'shawarma', 'sandwiches'],
  },
  {
    id: 'combos-bowls',
    label: 'Combos & Healthy Bowls',
    categories: ['combos', 'healthy-bowls', 'salads', 'grills'],
  },
  {
    id: 'shakes-boba',
    label: 'Boba, Shakes & Mojitos',
    categories: ['milkshakes', 'thick-shakes', 'mojito', 'boba-tea-coffee'],
  },
  {
    id: 'desserts',
    label: 'Desserts & Sweets',
    categories: ['desserts', 'ice-creams'],
  },
  {
    id: 'momos',
    label: 'Momos',
    categories: ['momos'],
  },
  {
    id: 'add-ons-dips',
    label: 'Add-Ons & Dips',
    categories: ['add-ons-dips'],
  },
];

export function cleanCustomerDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .replace(/•?\s*Source note:.*$/i, '')
    .replace(/•?\s*Note:.*$/i, '')
    .replace(/as extracted;?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const SPECIALTY_COLD_BREW_PRODUCTS: Product[] = [
  {
    slug: 'cold-brew-espresso-orange',
    category: 'cold-brew',
    name: 'Espresso Orange',
    description:
      'Handcrafted specialty cold brew layered with bright citrus tonic, refreshing Valencia orange infusion, and crowned with rich, bold espresso. Served over crystal ice with a fresh orange wheel.',
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
    slug: 'cold-brew-tiger-bomb',
    category: 'cold-brew',
    name: 'Tiger Bomb Cold Brew',
    description:
      'A sensory and visual showstopper: concentrated slow-steeped cold brew marbled through velvety sweet cream and condensed milk over ice. The signature tiger-stripe cascade creates a luscious, dessert-like coffee experience.',
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
    slug: 'cold-brew-passion-fruit',
    category: 'cold-brew',
    name: 'Passion Fruit Cold Brew',
    description:
      'Exotic tropical passion fruit pulp and glistening seeds floating in a crisp sparkling tonic, crowned with deep dark cold brew and fresh aromatic mint sprigs. An invigorating sweet-tart spark that completely reinvents iced coffee.',
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
];

const reconciledProducts: Product[] = (menuData.products as Product[]).map((p) => ({
  ...p,
  description: cleanCustomerDescription(p.description),
  variants:
    p.variants && p.variants.length > 0
      ? p.variants
      : p.is_price_unclear
      ? [{ name: 'Price to be verified', price_paise: 0 }]
      : [{ name: 'Regular', price_paise: 19900 }],
}));

export const ALL_PRODUCTS: Product[] = [
  ...SPECIALTY_COLD_BREW_PRODUCTS,
  ...reconciledProducts,
];

export function getMustTryProducts(): Product[] {
  return ALL_PRODUCTS.filter((p) => p.is_must_try);
}

export function filterProducts(
  groupId: string,
  dietFilter: 'ALL' | 'VEG' | 'NON_VEG',
  searchQuery: string = ''
): Product[] {
  const query = searchQuery.trim().toLowerCase();

  return ALL_PRODUCTS.filter((p) => {
    // 1. Group filtering
    if (groupId !== 'all') {
      const group = CATEGORY_GROUPS.find((g) => g.id === groupId);
      if (group && group.categories.length > 0) {
        if (!group.categories.includes(p.category)) return false;
      }
    }

    // 2. Diet filtering
    if (dietFilter !== 'ALL') {
      if (p.dietary_classification !== dietFilter) return false;
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
