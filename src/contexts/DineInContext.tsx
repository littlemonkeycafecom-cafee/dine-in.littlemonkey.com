import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant, ProductAddon, CartItem, CustomerSession, DiningSession } from '../types';
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
  cleanQrUrlParams,
  persistCustomerSession,
  clearCustomerSession,
  verifyScannedQr,
  initiateDiningSession,
  checkDiningSessionStatus,
  terminateDiningSession,
  AUTH_STORAGE_KEYS,
} from '../services/auth';

interface DineInContextType {
  customer: CustomerSession | null;
  diningSession: DiningSession | null;
  diningSessionRemainingMs: number;
  isQrAuthorized: boolean;
  isQrRequired: boolean;
  isSessionExpired: boolean;
  qrError: string | null;
  qrProofToken: string | null;
  isValidatingAuth: boolean;
  tableNumber: string;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isAuthModalOpen: boolean;
  isCartDrawerOpen: boolean;
  isAdminModalOpen: boolean;
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
  signIn: (mobile: string, name?: string, token?: string, id?: string, role?: string) => Promise<void>;
  signOut: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openAdminModal: () => void;
  closeAdminModal: () => void;
  openCart: () => void;
  closeCart: () => void;
  setSelectedProduct: (product: Product | null) => void;
  resetSessionState: () => void;
}

const DineInContext = createContext<DineInContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lm_dinein_cart_v2';

export const DineInProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Table Number state
  const [tableNumber, setTableNumber] = useState<string>('Table 01');

  // QR Access State
  const [isQrAuthorized, setIsQrAuthorized] = useState<boolean>(false);
  const [isQrRequired, setIsQrRequired] = useState<boolean>(false);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrProofToken, setQrProofToken] = useState<string | null>(null);

  // 30-Minute Dining Session State
  const [diningSession, setDiningSession] = useState<DiningSession | null>(null);
  const [diningSessionRemainingMs, setDiningSessionRemainingMs] = useState<number>(0);

  // Customer Session & Validation State
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [isValidatingAuth, setIsValidatingAuth] = useState<boolean>(true);

  // Admin Modal
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Live Authoritative Products & Store Status
  const [products, setProducts] = useState<Product[]>(ALL_PRODUCTS);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(true);
  const [isDineInOpen, setIsDineInOpen] = useState<boolean>(true);
  const [isTableRevoked, setIsTableRevoked] = useState<boolean>(false);
  const [tableRevocationReason, setTableRevocationReason] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Initial Access Evaluation: Verify QR vs Existing Session vs Direct Entry
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function evaluateAccess() {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const rawTable = params.get('table') || params.get('t');
      const rawCred = params.get('cred') || params.get('c');
      const devPreviewToken = params.get('token') || params.get('auth_token');

      // Case 1: Physical QR Code Scanned (cred present in URL)
      if (rawCred) {
        setIsValidatingAuth(true);
        const qrRes = await verifyScannedQr(rawTable || '', rawCred);
        if (!isMounted) return;

        if (qrRes.valid && qrRes.tableNumber && qrRes.qrProofToken) {
          setTableNumber(qrRes.tableNumber);
          setIsQrAuthorized(true);
          setQrProofToken(qrRes.qrProofToken);
          setQrError(null);
          setIsQrRequired(false);
          sessionStorage.setItem(AUTH_STORAGE_KEYS.QR_PROOF, qrRes.qrProofToken);
          cleanQrUrlParams();

          // Check if customer already has a valid authentication session
          const candidate = detectCandidateToken();
          if (candidate?.token) {
            const customerCheck = await validateSessionToken(candidate.token);
            if (customerCheck.valid && customerCheck.user) {
              const cleanDigits = String(customerCheck.user.phone || '').replace(/\D/g, '').slice(-10);
              const validCust: CustomerSession = {
                id: customerCheck.user.id,
                mobile: cleanDigits || '9876543210',
                name: customerCheck.user.name || 'Diner',
                token: candidate.token,
                isAuthenticated: true,
                tableNumber: qrRes.tableNumber,
              };
              setCustomer(validCust);

              // Initiate 30-minute dining session
              const sessRes = await initiateDiningSession(qrRes.qrProofToken, candidate.token);
              if (sessRes.success && sessRes.session) {
                setDiningSession(sessRes.session);
                setDiningSessionRemainingMs(sessRes.session.timeRemainingMs);
                sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sessRes.sessionToken || sessRes.session.sessionId);
              }
            }
          }
        } else {
          setQrError(qrRes.message || 'QR code verification failed. Please scan a valid table QR.');
          setIsQrAuthorized(false);
          setIsQrRequired(true);
          cleanQrUrlParams();
        }
        setIsValidatingAuth(false);
        return;
      }

      // Case 2: Existing Active Dining Session in sessionStorage
      const savedSessionToken = sessionStorage.getItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      if (savedSessionToken) {
        setIsValidatingAuth(true);
        const statusRes = await checkDiningSessionStatus(savedSessionToken);
        if (!isMounted) return;

        if (statusRes.valid && statusRes.tableNumber) {
          setTableNumber(statusRes.tableNumber);
          setIsQrAuthorized(true);
          setIsQrRequired(false);
          setIsSessionExpired(false);
          setDiningSession({
            sessionId: savedSessionToken,
            tableNumber: statusRes.tableNumber,
            expiresAt: statusRes.expiresAt || 0,
            timeRemainingMs: statusRes.timeRemainingMs || 0,
            createdAt: (statusRes.expiresAt || 0) - 1800000,
          });
          setDiningSessionRemainingMs(statusRes.timeRemainingMs || 0);

          // Restore customer info if available
          const candidate = detectCandidateToken();
          if (candidate?.token) {
            const customerCheck = await validateSessionToken(candidate.token);
            if (customerCheck.valid && customerCheck.user) {
              const cleanDigits = String(customerCheck.user.phone || '').replace(/\D/g, '').slice(-10);
              setCustomer({
                id: customerCheck.user.id,
                mobile: cleanDigits || '9876543210',
                name: customerCheck.user.name || 'Diner',
                token: candidate.token,
                isAuthenticated: true,
                tableNumber: statusRes.tableNumber,
              });
            }
          }
        } else {
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
          setDiningSession(null);
          if (statusRes.error === 'DINING_SESSION_EXPIRED' || statusRes.error === 'EXPIRED_SESSION') {
            setIsSessionExpired(true);
          } else if (statusRes.error === 'CREDENTIAL_REVOKED') {
            setIsTableRevoked(true);
            setTableRevocationReason(statusRes.message || 'This table QR code was revoked by café staff.');
          } else {
            setIsQrRequired(true);
          }
        }
        setIsValidatingAuth(false);
        return;
      }

      // Case 3: Dev Preview Token (Allowed only in development mode)
      if (devPreviewToken && devPreviewToken.includes('dev_preview_token')) {
        const tbl = rawTable ? `Table ${String(rawTable.replace(/\D/g, '')).padStart(2, '0')}` : 'Table 04';
        setTableNumber(tbl);
        setIsQrAuthorized(true);
        setIsQrRequired(false);
        setIsValidatingAuth(false);
        return;
      }

      // Case 4: Direct URL / Incognito / Copied URL without QR code
      // Block access! Physical QR scanning is mandatory!
      setIsQrAuthorized(false);
      setIsQrRequired(true);
      setCustomer(null);
      setDiningSession(null);
      setIsValidatingAuth(false);
    }

    evaluateAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Strict 30-Minute Live Countdown Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!diningSession) return;

    const timer = setInterval(() => {
      setDiningSessionRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          setIsSessionExpired(true);
          setDiningSession(null);
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [diningSession]);

  // Check Table Status Helper
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

  const signIn = async (
    mobile: string,
    name: string = 'Guest Diner',
    token?: string,
    id?: string,
    role?: string
  ) => {
    const cleanDigits = mobile.replace(/\D/g, '').slice(-10);
    const isGuest = role === 'guest' || cleanDigits === '9999999999' || mobile.toLowerCase().includes('guest');
    const effectiveToken = token || (isGuest ? 'dev_token_guest' : `dev_token_${cleanDigits}`);

    const session: CustomerSession = {
      id: id || `user_${cleanDigits}`,
      mobile: cleanDigits,
      name,
      token: effectiveToken,
      isAuthenticated: true,
      tableNumber,
      role: role || (isGuest ? 'guest' : 'customer'),
      isGuest,
    };
    setCustomer(session);
    persistCustomerSession(session);
    setIsAuthModalOpen(false);

    // If a valid QR Proof exists, initiate the 30-minute Dining Session
    const proof = qrProofToken || (typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.QR_PROOF) : null);
    if (proof) {
      try {
        const sessRes = await initiateDiningSession(proof, effectiveToken);
        if (sessRes.success && sessRes.session) {
          setDiningSession(sessRes.session);
          setDiningSessionRemainingMs(sessRes.session.timeRemainingMs);
          sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sessRes.sessionToken || sessRes.session.sessionId);
          setIsQrAuthorized(true);
          setIsQrRequired(false);
          setIsSessionExpired(false);
        }
      } catch (err) {
        console.warn('[DineInContext] Dining session initiation error:', err);
      }
    }
  };

  const signOut = () => {
    if (diningSession?.sessionId) {
      terminateDiningSession(diningSession.sessionId);
    }
    clearCustomerSession();
    setCustomer(null);
    setDiningSession(null);
    setIsQrAuthorized(false);
    setIsQrRequired(true);
    setIsAuthModalOpen(false);
  };

  const resetSessionState = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
    }
    setDiningSession(null);
    setIsSessionExpired(false);
    setIsQrAuthorized(false);
    setIsQrRequired(true);
  };

  return (
    <DineInContext.Provider
      value={{
        customer,
        diningSession,
        diningSessionRemainingMs,
        isQrAuthorized,
        isQrRequired,
        isSessionExpired,
        qrError,
        qrProofToken,
        isValidatingAuth,
        tableNumber,
        cart,
        cartCount,
        cartSubtotal,
        isAuthModalOpen,
        isCartDrawerOpen,
        isAdminModalOpen,
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
        openAdminModal: () => setIsAdminModalOpen(true),
        closeAdminModal: () => setIsAdminModalOpen(false),
        openCart: () => setIsCartDrawerOpen(true),
        closeCart: () => setIsCartDrawerOpen(false),
        setSelectedProduct,
        resetSessionState,
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
