export interface ProductVariant {
  name: string;
  price_paise: number;
  original_price_paise?: number;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface ProductIngredient {
  name: string;
  detail?: string;
}

export interface Product {
  slug: string;
  category: string;
  name: string;
  description: string;
  dietary_classification: 'VEG' | 'NON_VEG';
  is_must_try: boolean;
  variants: ProductVariant[];
  image_url?: string | null;
  is_available?: boolean;
  is_price_unclear?: boolean;
  verification_flag?: string | null;
  original_price?: number; // In Rupees (e.g. 299 for selling price 249)
  discount_percent?: number; // e.g. 17 for 17% OFF
  tagline?: string;
  badge?: string;
  ingredients?: ProductIngredient[];
  process_steps?: string[];
}

export interface CartItem {
  id: string;
  product: Product;
  selectedVariant: ProductVariant;
  selectedAddons: ProductAddon[];
  kitchenInstructions?: string;
  quantity: number;
  unitPrice: number; // in Rupees
  totalPrice: number; // in Rupees
}

export interface CustomerSession {
  id?: string;
  mobile: string;
  name: string;
  token?: string;
  expiresAt?: number;
  isAuthenticated: boolean;
  tableNumber?: string;
}

export interface MenuCategoryGroup {
  id: string;
  label: string;
  categories: string[];
}
