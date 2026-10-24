import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, ProductVariant, ProductAddon, CartItem, CustomerSession } from '../types';

interface DineInContextType {
  customer: CustomerSession | null;
  tableNumber: string;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isAuthModalOpen: boolean;
  isCartDrawerOpen: boolean;
  selectedProduct: Product | null;
  addToCart: (
    product: Product,
    variant?: ProductVariant,
    addons?: ProductAddon[],
    instructions?: string,
    quantity?: number
  ) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  signIn: (mobile: string, name?: string) => void;
  signOut: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openCart: () => void;
  closeCart: () => void;
  setSelectedProduct: (product: Product | null) => void;
}

const DineInContext = createContext<DineInContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lm_dinein_cart_v2';
const AUTH_STORAGE_KEY = 'lm_dinein_auth_v2';

export const DineInProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Table Number from URL query parameter or default
  const [tableNumber, setTableNumber] = useState<string>('Table 4');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tbl = params.get('table') || params.get('t');
      if (tbl) {
        setTableNumber(`Table ${tbl.replace(/^table\s*/i, '')}`);
      }
    }
  }, []);

  // Customer Session
  const [customer, setCustomer] = useState<CustomerSession | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore corrupted data
        }
      }
    }
    return null;
  });

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Sync cart to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  // Sync customer to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (customer) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(customer));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, [customer]);

  // Calculate totals
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const addToCart = (
    product: Product,
    variant?: ProductVariant,
    addons: ProductAddon[] = [],
    instructions: string = '',
    quantity: number = 1
  ) => {
    const chosenVariant = variant || product.variants[0] || { name: 'Regular', price_paise: 19900 };
    const addonsCost = addons.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = Math.round(chosenVariant.price_paise / 100) + addonsCost;
    const cartItemId = `${product.slug}-${chosenVariant.name}-${addons.map((a) => a.id).sort().join(',')}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === cartItemId);
      if (existingIndex > -1) {
        const next = [...prev];
        const updatedQty = next[existingIndex].quantity + quantity;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: updatedQty,
          totalPrice: updatedQty * unitPrice,
          kitchenInstructions: instructions || next[existingIndex].kitchenInstructions,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            product,
            selectedVariant: chosenVariant,
            selectedAddons: addons,
            kitchenInstructions: instructions,
            quantity,
            unitPrice,
            totalPrice: quantity * unitPrice,
          },
        ];
      }
    });
  };

  const updateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice,
            }
          : item
      )
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const signIn = (mobile: string, name: string = 'Guest Diner') => {
    const session: CustomerSession = {
      mobile,
      name,
      isAuthenticated: true,
      tableNumber,
    };
    setCustomer(session);
    setIsAuthModalOpen(false);
  };

  const signOut = () => {
    setCustomer(null);
  };

  return (
    <DineInContext.Provider
      value={{
        customer,
        tableNumber,
        cart,
        cartCount,
        cartSubtotal,
        isAuthModalOpen,
        isCartDrawerOpen,
        selectedProduct,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        signIn,
        signOut,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        openCart: () => setIsCartDrawerOpen(true),
        closeCart: () => setIsCartDrawerOpen(false),
        setSelectedProduct,
      }}
    >
      {children}
    </DineInContext.Provider>
  );
};

export const useDineIn = () => {
  const context = useContext(DineInContext);
  if (!context) {
    throw new Error('useDineIn must be used within a DineInProvider');
  }
  return context;
};
