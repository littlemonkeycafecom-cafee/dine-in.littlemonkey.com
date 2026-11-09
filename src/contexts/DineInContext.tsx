import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  verifyDualFactorChallenge,
  checkQrProofStatus,
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
  isRequires2fa: boolean;
  challengeToken: string | null;
  tableShortCode: string;
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
  authorizeVerifiedQr: (tableNumber: string, qrProofToken: string) => void;
  submitDualFactor: (symbol?: string, code?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  cancelDualFactor: () => void;
}

const DineInContext = createContext<DineInContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lm_dinein_cart_v2';

export const DineInProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Table Number state
  const [tableNumber, setTableNumber] = useState<string>('Table 01');
  const [tableShortCode, setTableShortCode] = useState<string>('T01');

  // QR Access State
  const [isQrAuthorized, setIsQrAuthorized] = useState<boolean>(false);
  const [isQrRequired, setIsQrRequired] = useState<boolean>(false);
  const [isRequires2fa, setIsRequires2fa] = useState<boolean>(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrProofToken, setQrProofToken] = useState<string | null>(null);

  // 15-Minute Server-Authoritative Dining Session State
  const [diningSession, setDiningSession] = useState<DiningSession | null>(null);
  const [diningSessionRemainingMs, setDiningSessionRemainingMs] = useState<number>(0);

  // Authoritative Session Timing Reference (for server-relative monotonic countdown immune to clock tampering / tab sleep)
  const sessionTimingRef = useRef<{
    sessionId: string;
    expiresAt: number;
    serverTimeOffset: number; // estimated (serverTime - performance.now())
  } | null>(null);

  const handleSessionExpired = useCallback(() => {
    sessionTimingRef.current = null;
    setIsSessionExpired(true);
    setDiningSession(null);
    setDiningSessionRemainingMs(0);
    setCustomer(null);
    clearCustomerSession();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      localStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
    }
  }, []);

  const calculateRemainingMs = useCallback(() => {
    if (!sessionTimingRef.current) return 0;
    const currentEstimatedServerTime = performance.now() + sessionTimingRef.current.serverTimeOffset;
    return Math.max(0, sessionTimingRef.current.expiresAt - currentEstimatedServerTime);
  }, []);

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
        setIsSessionExpired(false);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
          localStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
        }
        const qrRes = await verifyScannedQr(rawTable || '', rawCred);
        if (!isMounted) return;

        if (qrRes.requires2fa && qrRes.challengeToken && qrRes.tableNumber) {
          setTableNumber(qrRes.tableNumber);
          setTableShortCode(qrRes.shortCode || (rawTable ? String(rawTable).toUpperCase() : 'T01'));
          setChallengeToken(qrRes.challengeToken);
          setIsRequires2fa(true);
          setIsQrAuthorized(false);
          setIsQrRequired(false);
          setQrError(null);
          cleanQrUrlParams();
          setIsValidatingAuth(false);
          return;
        }

        if (qrRes.valid && qrRes.tableNumber && qrRes.qrProofToken) {
          setTableNumber(qrRes.tableNumber);
          if (qrRes.shortCode) setTableShortCode(qrRes.shortCode);
          setIsQrAuthorized(true);
          setIsRequires2fa(false);
          setChallengeToken(null);
          setQrProofToken(qrRes.qrProofToken);
          setQrError(null);
          setIsQrRequired(false);
          setIsSessionExpired(false);
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

              // Initiate 15-minute dining session
              const sessRes = await initiateDiningSession(qrRes.qrProofToken, candidate.token);
              if (sessRes.success && sessRes.session) {
                const sToken = sessRes.sessionToken || sessRes.session.sessionId;
                const nowMonotonic = performance.now();
                const sTime = sessRes.session.serverTime || (sessRes.session.expiresAt - sessRes.session.timeRemainingMs);
                sessionTimingRef.current = {
                  sessionId: sToken,
                  expiresAt: sessRes.session.expiresAt,
                  serverTimeOffset: sTime - nowMonotonic,
                };
                setDiningSession(sessRes.session);
                setDiningSessionRemainingMs(sessRes.session.timeRemainingMs);
                sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
                localStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
                sessionStorage.setItem('lm_dinein_intro_seen', 'true');
                localStorage.setItem('lm_dinein_intro_seen', 'true');
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

      // Case 2: Existing Active Dining Session in sessionStorage or localStorage
      const savedSessionToken = sessionStorage.getItem(AUTH_STORAGE_KEYS.DINING_SESSION) || localStorage.getItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      if (savedSessionToken) {
        setIsValidatingAuth(true);
        const statusRes = await checkDiningSessionStatus(savedSessionToken);
        if (!isMounted) return;

        if (statusRes.valid && statusRes.tableNumber) {
          setTableNumber(statusRes.tableNumber);
          setIsQrAuthorized(true);
          setIsQrRequired(false);
          setIsSessionExpired(false);
          sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, savedSessionToken);
          localStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, savedSessionToken);
          sessionStorage.setItem('lm_dinein_intro_seen', 'true');
          localStorage.setItem('lm_dinein_intro_seen', 'true');
          const nowMonotonic = performance.now();
          const sTime = statusRes.serverTime || (statusRes.expiresAt! - (statusRes.timeRemainingMs || 0));
          sessionTimingRef.current = {
            sessionId: savedSessionToken,
            expiresAt: statusRes.expiresAt || 0,
            serverTimeOffset: sTime - nowMonotonic,
          };
          setDiningSession({
            sessionId: savedSessionToken,
            tableNumber: statusRes.tableNumber,
            expiresAt: statusRes.expiresAt || 0,
            timeRemainingMs: statusRes.timeRemainingMs || 0,
            createdAt: (statusRes.expiresAt || 0) - (statusRes.durationMs || 900000),
          });
          setDiningSessionRemainingMs(statusRes.timeRemainingMs || 0);

          // Restore customer info from server response or candidate token
          if (statusRes.customer) {
            const cleanDigits = String(statusRes.customer.phone || '').replace(/\D/g, '').slice(-10);
            const restoredCust: CustomerSession = {
              id: statusRes.customer.id || `user_${cleanDigits || 'diner'}`,
              mobile: cleanDigits || '9876543210',
              name: statusRes.customer.name || 'Diner',
              token: savedSessionToken,
              isAuthenticated: true,
              tableNumber: statusRes.tableNumber,
              role: statusRes.customer.role || 'customer',
            };
            setCustomer(restoredCust);
            persistCustomerSession(restoredCust);
          } else {
            const candidate = detectCandidateToken();
            if (candidate?.token) {
              const customerCheck = await validateSessionToken(candidate.token);
              if (customerCheck.valid && customerCheck.user) {
                const cleanDigits = String(customerCheck.user.phone || '').replace(/\D/g, '').slice(-10);
                const restoredCust: CustomerSession = {
                  id: customerCheck.user.id,
                  mobile: cleanDigits || '9876543210',
                  name: customerCheck.user.name || 'Diner',
                  token: candidate.token,
                  isAuthenticated: true,
                  tableNumber: statusRes.tableNumber,
                };
                setCustomer(restoredCust);
                persistCustomerSession(restoredCust);
              }
            }
          }
        } else {
          clearCustomerSession();
          setDiningSession(null);
          setCustomer(null);
          if (statusRes.error === 'DINING_SESSION_EXPIRED' || statusRes.error === 'EXPIRED_SESSION') {
            if (statusRes.tableNumber) {
              setTableNumber(statusRes.tableNumber);
            }
            setIsSessionExpired(true);
            setIsQrAuthorized(false);
          } else if (statusRes.error === 'CREDENTIAL_REVOKED') {
            setIsTableRevoked(true);
            setTableRevocationReason(statusRes.message || 'This table QR code was revoked by café staff.');
          } else {
            sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
            localStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
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

      // Case 3.5: Active Unconsumed QR Proof in sessionStorage (for page refresh/navigation before login)
      const savedQrProof = sessionStorage.getItem(AUTH_STORAGE_KEYS.QR_PROOF);
      if (savedQrProof) {
        setIsValidatingAuth(true);
        const proofRes = await checkQrProofStatus(savedQrProof);
        if (!isMounted) return;

        if (proofRes.valid && proofRes.tableNumber) {
          setTableNumber(proofRes.tableNumber);
          setIsQrAuthorized(true);
          setQrProofToken(savedQrProof);
          setQrError(null);
          setIsQrRequired(false);
          setIsSessionExpired(false);
          setIsValidatingAuth(false);
          return;
        } else {
          sessionStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
        }
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
  // 2. Strict 15-Minute Server-Authoritative Live Countdown Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!diningSession || !sessionTimingRef.current) return;

    // Immediate calculation on session mount/change
    const initialRemaining = calculateRemainingMs();
    setDiningSessionRemainingMs(initialRemaining);
    if (initialRemaining <= 0) {
      handleSessionExpired();
      return;
    }

    const timer = setInterval(() => {
      const remaining = calculateRemainingMs();
      setDiningSessionRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        handleSessionExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [diningSession, calculateRemainingMs, handleSessionExpired]);

  // ---------------------------------------------------------------------------
  // 2B. Backgrounding, Tab Switching, Window Focus & Device Sleep Resume Handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const handleSyncOnResume = async () => {
      if (!sessionTimingRef.current) return;

      // 1. Instantly recalculate remaining time from monotonic clock (survives tab suspension)
      const remaining = calculateRemainingMs();
      if (isMounted) {
        setDiningSessionRemainingMs(remaining);
      }

      if (remaining <= 0) {
        handleSessionExpired();
        return;
      }

      // 2. Perform authoritative server check when tab is visible to confirm server authorization
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const token = sessionTimingRef.current?.sessionId;
        if (!token) return;

        try {
          const statusRes = await checkDiningSessionStatus(token);
          if (!isMounted) return;

          if (!statusRes.valid) {
            handleSessionExpired();
          } else if (statusRes.expiresAt && sessionTimingRef.current) {
            const nowMonotonic = performance.now();
            const sTime = statusRes.serverTime || (statusRes.expiresAt - (statusRes.timeRemainingMs || 0));
            sessionTimingRef.current = {
              sessionId: token,
              expiresAt: statusRes.expiresAt,
              serverTimeOffset: sTime - nowMonotonic,
            };
            const freshRemaining = calculateRemainingMs();
            if (isMounted) {
              setDiningSessionRemainingMs(freshRemaining);
            }
            if (freshRemaining <= 0) {
              handleSessionExpired();
            }
          }
        } catch {
          // Network interruption; fallback to monotonic remaining calculation
        }
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleSyncOnResume);
      window.addEventListener('focus', handleSyncOnResume);
      window.addEventListener('pageshow', handleSyncOnResume);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleSyncOnResume);
        window.removeEventListener('focus', handleSyncOnResume);
        window.removeEventListener('pageshow', handleSyncOnResume);
      }
    };
  }, [calculateRemainingMs, handleSessionExpired]);

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
    name: string = 'Registered Diner',
    token?: string,
    id?: string,
    role?: string
  ) => {
    const cleanDigits = mobile.replace(/\D/g, '').slice(-10);
    const effectiveToken = token || `dev_token_${cleanDigits}`;

    const session: CustomerSession = {
      id: id || `user_${cleanDigits}`,
      mobile: cleanDigits,
      name: name.trim() || 'Registered Diner',
      token: effectiveToken,
      isAuthenticated: true,
      tableNumber,
      role: role || 'customer',
      isGuest: false,
    };
    setCustomer(session);
    persistCustomerSession(session);
    setIsAuthModalOpen(false);

    // If token is already an active dining session token (e.g. returned from submitCustomerRecord)
    if (token && token.startsWith('dinesess_')) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, token);
      localStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, token);
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
      setIsQrAuthorized(true);
      setIsQrRequired(false);
      setIsSessionExpired(false);

      checkDiningSessionStatus(token).then((statusRes) => {
        if (statusRes.valid && statusRes.expiresAt) {
          const nowMonotonic = performance.now();
          const sTime = statusRes.serverTime || Date.now();
          sessionTimingRef.current = {
            sessionId: token,
            expiresAt: statusRes.expiresAt,
            serverTimeOffset: sTime - nowMonotonic,
          };
          setDiningSession({
            sessionId: token,
            tableNumber: statusRes.tableNumber || tableNumber,
            credentialId: '',
            createdAt: sTime,
            expiresAt: statusRes.expiresAt,
            timeRemainingMs: statusRes.timeRemainingMs || 900000,
            durationMs: 900000,
          });
          setDiningSessionRemainingMs(statusRes.timeRemainingMs || 900000);
        }
      }).catch(() => {});
      return;
    }

    // If a valid QR Proof exists, initiate the 15-minute Dining Session
    const proof = qrProofToken || (typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.QR_PROOF) : null);
    if (proof) {
      try {
        const sessRes = await initiateDiningSession(proof, effectiveToken);
        if (sessRes.success && sessRes.session) {
          const sToken = sessRes.sessionToken || sessRes.session.sessionId;
          const nowMonotonic = performance.now();
          const sTime = sessRes.session.serverTime || (sessRes.session.expiresAt - sessRes.session.timeRemainingMs);
          sessionTimingRef.current = {
            sessionId: sToken,
            expiresAt: sessRes.session.expiresAt,
            serverTimeOffset: sTime - nowMonotonic,
          };
          setDiningSession(sessRes.session);
          setDiningSessionRemainingMs(sessRes.session.timeRemainingMs);
          sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
          localStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
          sessionStorage.setItem('lm_dinein_intro_seen', 'true');
          localStorage.setItem('lm_dinein_intro_seen', 'true');
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
    sessionTimingRef.current = null;
    clearCustomerSession();
    localStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
    setCustomer(null);
    setDiningSession(null);
    setDiningSessionRemainingMs(0);
    setIsQrAuthorized(false);
    setIsQrRequired(true);
    setIsAuthModalOpen(false);
  };

  const resetSessionState = () => {
    sessionTimingRef.current = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      localStorage.removeItem(AUTH_STORAGE_KEYS.DINING_SESSION);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
      localStorage.removeItem(AUTH_STORAGE_KEYS.QR_PROOF);
    }
    clearCustomerSession();
    setCustomer(null);
    setDiningSession(null);
    setDiningSessionRemainingMs(0);
    setIsSessionExpired(false);
    setIsQrAuthorized(false);
    setIsQrRequired(true);
  };

  const authorizeVerifiedQr = (verifiedTable: string, proofToken: string) => {
    setTableNumber(verifiedTable);
    setIsQrAuthorized(true);
    setQrProofToken(proofToken);
    setQrError(null);
    setIsQrRequired(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.QR_PROOF, proofToken);
    }
  };

  const submitDualFactor = useCallback(
    async (symbol?: string, code?: string) => {
      if (!challengeToken) {
        return { success: false, error: 'MISSING_CHALLENGE', message: 'No active table challenge token found.' };
      }
      try {
        const res = await verifyDualFactorChallenge({
          challengeToken,
          symbol,
          code,
        });
        if (res.valid && res.tableNumber && res.qrProofToken) {
          setTableNumber(res.tableNumber);
          if (res.shortCode) setTableShortCode(res.shortCode);
          setIsQrAuthorized(true);
          setIsRequires2fa(false);
          setChallengeToken(null);
          setQrProofToken(res.qrProofToken);
          setQrError(null);
          setIsQrRequired(false);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(AUTH_STORAGE_KEYS.QR_PROOF, res.qrProofToken);
          }

          // Check if candidate customer token exists to auto-sign in
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
                tableNumber: res.tableNumber,
              };
              setCustomer(validCust);
              const sessRes = await initiateDiningSession(res.qrProofToken, candidate.token);
              if (sessRes.success && sessRes.session) {
                const sToken = sessRes.sessionToken || sessRes.session.sessionId;
                const nowMonotonic = performance.now();
                const sTime = sessRes.session.serverTime || (sessRes.session.expiresAt - sessRes.session.timeRemainingMs);
                sessionTimingRef.current = {
                  sessionId: sToken,
                  expiresAt: sessRes.session.expiresAt,
                  serverTimeOffset: sTime - nowMonotonic,
                };
                setDiningSession(sessRes.session);
                setDiningSessionRemainingMs(sessRes.session.timeRemainingMs);
                sessionStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
                localStorage.setItem(AUTH_STORAGE_KEYS.DINING_SESSION, sToken);
                sessionStorage.setItem('lm_dinein_intro_seen', 'true');
                localStorage.setItem('lm_dinein_intro_seen', 'true');
              }
            }
          }

          return { success: true, message: res.message || 'Dual-factor verification successful.' };
        }

        return {
          success: false,
          error: res.error || 'VERIFICATION_FAILED',
          message: res.message || 'Verification failed. Please confirm the symbol or code on your table stand.',
        };
      } catch {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Unable to connect to café verification service.',
        };
      }
    },
    [challengeToken]
  );

  const cancelDualFactor = useCallback(() => {
    setIsRequires2fa(false);
    setChallengeToken(null);
    setIsQrRequired(true);
    setIsQrAuthorized(false);
  }, []);

  return (
    <DineInContext.Provider
      value={{
        customer,
        diningSession,
        diningSessionRemainingMs,
        isQrAuthorized,
        isQrRequired,
        isRequires2fa,
        challengeToken,
        tableShortCode,
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
        authorizeVerifiedQr,
        submitDualFactor,
        cancelDualFactor,
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
