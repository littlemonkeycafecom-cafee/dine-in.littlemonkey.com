import menuData from '../data/reconciled-menu.json';
import { Product, MenuCategoryGroup } from '../types';

export const CATEGORY_GROUPS: MenuCategoryGroup[] = [
  { id: 'all', label: 'All Items', categories: [] },
  { id: 'pizzas', label: 'Pizzas', categories: ['thin-crust-pizza', 'pizza-combos'] },
  { id: 'burgers', label: 'Burgers', categories: ['burgers', 'burger-combos'] },
  {
    id: 'coffee-tea',
    label: 'Coffee & Teas',
    categories: [
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

export const ALL_PRODUCTS: Product[] = (menuData.products as Product[]).map((p) => ({
  ...p,
  variants:
    p.variants && p.variants.length > 0
      ? p.variants
      : p.is_price_unclear
      ? [{ name: 'Price to be verified', price_paise: 0 }]
      : [{ name: 'Regular', price_paise: 19900 }],
}));

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
      const matchName = p.name.toLowerCase().includes(query);
      const matchDesc = p.description.toLowerCase().includes(query);
      const matchCat = p.category.toLowerCase().includes(query);
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
