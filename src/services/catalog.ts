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
      'special-green-tea-pot',
    ],
  },
  {
    id: 'fries-sides',
    label: 'Fries & Quick Bites',
    categories: ['fries', 'garlic-bread', 'sides-quick-bites', 'extra-dips'],
  },
  {
    id: 'pasta-shawarma',
    label: 'Shawarma, Pasta & Sandwiches',
    categories: ['pasta', 'shawarma', 'sandwiches'],
  },
  {
    id: 'crispy-grills',
    label: 'Crispy Wings & Grills',
    categories: ['crispy-chicken', 'crispy-fish', 'grills'],
  },
  {
    id: 'combos-bowls',
    label: 'Combos & Healthy Bowls',
    categories: ['combos', 'healthy-bowls', 'salads'],
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
];

export const ALL_PRODUCTS: Product[] = (menuData.products as Product[]).map((p) => ({
  ...p,
  variants: p.variants && p.variants.length > 0 ? p.variants : [{ name: 'Regular', price_paise: 19900 }],
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

export function getBasePrice(product: Product): number {
  if (!product.variants || product.variants.length === 0) return 0;
  return Math.round(product.variants[0].price_paise / 100);
}
