import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant, ProductAddon, CartItem, CustomerSession } from '../types';
import {
  ALL_PRODUCTS,
  fetchCatalogStatus,
  applyLiveUpdates,
  CatalogStatus,
} from '../services/catalog';
import {
  validateSessionToken,
  detectCandidateToken,
  cleanAuthUrlParams,
  persistCustomerSession,
  clearCustomerSession,
} from '../services/auth';

interface DineInContextType {
  customer: CustomerSession | null;
  isValidatingAuth: boolean;
  tableNumber: string;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isAuthModalOpen: boolean;
  isCartDrawerOpen: boolean;
  selectedProduct: Product | null;
  isVegOnly: boolean;
  products: Product[];
  isStoreOpen: boolean;
  isDineInOpen: boolean;
  isTableRevoked: boolean;
  tableRevocationReason: string | null;
  setIsVegOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleVegOnly: () => void;
  addToCart: (
    product: Product,
    variant?: ProductVariant,
    addons?: ProductAddon[],
    instructions?: string,
    quantity?: number
  ) => boolean;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  placeDineInOrder: (instructions?: string, paymentMethod?: string) => Promise<any>;
  refreshCatalog: () => Promise<void>;
  signIn: (mobile: string, name?: string, token?: string, id?: string) => void;
  signOut: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openCart: () => void;
  closeCart: () => void;
  setSelectedProduct: (product: Product | null) => void;
}

const DineInContext = createContext<DineInContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lm_dinein_cart_v2';

export const DineInProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Table Number from URL query parameter or default
  const [tableNumber, setTableNumber] = useState<string>('Table 04');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tbl = params.get('table') || params.get('t');
      if (tbl) {
        const numMatch = tbl.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          setTableNumber(`Table ${String(num).padStart(2, '0')}`);
        } else {
          setTableNumber(tbl.trim());
        }
      }
    }
  }, []);

  // Customer Session & Validation State
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [isValidatingAuth, setIsValidatingAuth] = useState<boolean>(true);

  // Authenticate session on mount with server-side validation
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const candidate = detectCandidateToken();

      if (!candidate?.token) {
        clearCustomerSession();
        if (isMounted) {
          setCustomer(null);
          setIsValidatingAuth(false);
        }
        return;
      }

      try {
        const verification = await validateSessionToken(candidate.token);

        if (!isMounted) return;

        if (verification.valid && verification.user) {
          const cleanDigits = String(verification.user.phone || '').replace(/\D/g, '').slice(-10);
          const validSession: CustomerSession = {
            id: verification.user.id,
            mobile: cleanDigits || '9876543210',
            name: verification.user.name || 'Diner',
            token: candidate.token,
            isAuthenticated: true,
            tableNumber,
          };
          setCustomer(validSession);
          persistCustomerSession(validSession);
          cleanAuthUrlParams();
        } else {
          // Token is expired, revoked, or invalid -> clear storage and enforce login gate
          clearCustomerSession();
          setCustomer(null);
        }
      } catch (err) {
        console.warn('[DineInContext] Session validation error:', err);
        clearCustomerSession();
        if (isMounted) {
          setCustomer(null);
        }
      } finally {
        if (isMounted) {
          setIsValidatingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [tableNumber]);

  // Live Authoritative Products & Store Status
  const [products, setProducts] = useState<Product[]>(ALL_PRODUCTS);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(true);
  const [isDineInOpen, setIsDineInOpen] = useState<boolean>(true);
  const [isTableRevoked, setIsTableRevoked] = useState<boolean>(false);
  const [tableRevocationReason, setTableRevocationReason] = useState<string | null>(null);

  const checkTableStatus = useCallback(async (tbl: string) => {
    try {
      const res = await fetch(`/api/dine-in/table-status?table=${encodeURIComponent(tbl)}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || data.error === 'REVOKED_TABLE' || data.isActive === false) {
        setIsTableRevoked(true);
        setTableRevocationReason(data.message || `Table ${tbl} QR credential has been revoked or deactivated by café administration.`);
      } else {
        setIsTableRevoked(false);
        setTableRevocationReason(null);
      }
    } catch {
      // keep previous state
    }
  }, []);

  useEffect(() => {
    if (tableNumber) {
      checkTableStatus(tableNumber);
    }
  }, [tableNumber, checkTableStatus]);

  const refreshCatalog = useCallback(async () => {
    const status = await fetchCatalogStatus();
    if (status) {
      setIsStoreOpen(status.isStoreOpen);
      setIsDineInOpen(status.isDineInOpen);
      setProducts(applyLiveUpdates(ALL_PRODUCTS, status));
      if (tableNumber) {
        checkTableStatus(tableNumber);
      }
    }
  }, [tableNumber, checkTableStatus]);

  useEffect(() => {
    refreshCatalog();
    const interval = setInterval(refreshCatalog, 30000);
    return () => clearInterval(interval);
  }, [refreshCatalog]);

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
  const [isVegOnly, setIsVegOnly] = useState<boolean>(false);

  const toggleVegOnly = () => {
    setIsVegOnly((prev) => !prev);
  };

  // Sync cart to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  // Calculate totals
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const addToCart = (
    product: Product,
    variant?: ProductVariant,
    addons: ProductAddon[] = [],
    instructions: string = '',
    quantity: number = 1
  ): boolean => {
    // Inventory Safeguard: Prevent adding out-of-stock items
    if (product.is_available === false) {
      alert(`"${product.name}" is currently sold out and unavailable for ordering.`);
      return false;
    }

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
    return true;
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

  const placeDineInOrder = async (instructions: string = '', paymentMethod: string = 'cash') => {
    if (!customer?.token) {
      throw new Error('Please sign in to place your Dine-In order.');
    }
    if (cart.length === 0) {
      throw new Error('Your cart is empty. Please add items to place an order.');
    }

    if (isTableRevoked) {
      throw new Error(tableRevocationReason || 'This table QR credential is deactivated. Please contact café staff.');
    }

    const orderPayload = {
      tableNumber,
      paymentMethod,
      instructions,
      items: cart.map((item) => ({
        id: item.product.slug,
        slug: item.product.slug,
        name: item.product.name,
        variant_name: item.selectedVariant.name,
        quantity: item.quantity,
        price: item.unitPrice,
        instructions: item.kitchenInstructions || '',
      })),
    };

    const res = await fetch('/api/dine-in/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to place dine-in order. Please try again.');
    }

    return data;
  };

  const signIn = (
    mobile: string,
    name: string = 'Guest Diner',
    token?: string,
    id?: string
  ) => {
    const cleanDigits = mobile.replace(/\D/g, '').slice(-10);
    const session: CustomerSession = {
      id: id || `user_${cleanDigits}`,
      mobile: cleanDigits,
      name,
      token,
      isAuthenticated: true,
      tableNumber,
    };
    setCustomer(session);
    persistCustomerSession(session);
    setIsAuthModalOpen(false);
  };

  const signOut = () => {
    clearCustomerSession();
    setCustomer(null);
    setIsAuthModalOpen(false);
  };

  return (
    <DineInContext.Provider
      value={{
        customer,
        isValidatingAuth,
        tableNumber,
        cart,
        cartCount,
        cartSubtotal,
        isAuthModalOpen,
        isCartDrawerOpen,
        selectedProduct,
        isVegOnly,
        products,
        isStoreOpen,
        isDineInOpen,
        isTableRevoked,
        tableRevocationReason,
        setIsVegOnly,
        toggleVegOnly,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        placeDineInOrder,
        refreshCatalog,
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
