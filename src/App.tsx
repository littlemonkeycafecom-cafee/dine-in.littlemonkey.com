import React, { useState, useEffect } from 'react';
import { DineInProvider, useDineIn } from './contexts/DineInContext';
import { NotFoundPage } from './components/NotFoundPage';
import { ALL_PRODUCTS, getMustTryProducts } from './services/catalog';
import { CompactHeader } from './components/CompactHeader';
import { HeroCarousel } from './components/HeroCarousel';
import { BrandMarquee } from './components/BrandMarquee';
import { ColdBrewHeroBanner } from './components/ColdBrewHeroBanner';
import { MustTryRail } from './components/MustTryRail';
import { MenuSection } from './components/MenuSection';
import { EditorialReviews } from './components/EditorialReviews';
import { ProductDetailsModal } from './components/ProductDetailsModal';
import { CategorySheetModal } from './components/CategorySheetModal';
import { BrandedIntroScreen } from './components/BrandedIntroScreen';
import { FloatingNavigation } from './components/FloatingNavigation';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerLoginGate } from './components/CustomerLoginGate';
import { TableQrRequiredGate, DiningSessionExpiredGate } from './components/QrAccessGates';
import { AdminQrManagementModal } from './components/AdminQrManagementModal';
import { SearchModal } from './components/SearchModal';
import { Product } from './types';
import { AlertTriangle } from 'lucide-react';

const DiningAppContent: React.FC = () => {
  const {
    customer,
    isValidatingAuth,
    tableNumber,
    isAuthModalOpen,
    closeAuthModal,
    selectedProduct,
    setSelectedProduct,
    products,
    isTableRevoked,
    tableRevocationReason,
    isQrAuthorized,
    isQrRequired,
    isSessionExpired,
    isAdminModalOpen,
    closeAdminModal,
  } = useDineIn();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [activeCategorySheetId, setActiveCategorySheetId] = useState('thin-crust-pizza');
  const [isIntroComplete, setIsIntroComplete] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('lm_dinein_intro_seen') === 'true';
  });

  const mustTryProducts = products.filter((p) => p.is_must_try);

  const handleExploreClick = () => {
    const el = document.getElementById('main-menu-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenCategorySheet = (categoryId: string) => {
    setActiveCategorySheetId(categoryId);
    setIsCategorySheetOpen(true);
  };

  const handleExploreColdBrew = () => {
    setSelectedCategoryId('cold-brew');
    const el = document.getElementById('main-menu-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    if (categoryId && categoryId !== 'all') {
      handleOpenCategorySheet(categoryId);
    } else {
      const el = document.getElementById('main-menu-catalog');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  // 0. Branded Welcome Intro Screen (First visit in session)
  if (!isIntroComplete) {
    return <BrandedIntroScreen onComplete={() => setIsIntroComplete(true)} />;
  }

  // 1. Session Probing State: Validating credentials server-side
  if (isValidatingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#080808',
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(251, 195, 36, 0.08) 0%, transparent 65%)',
          color: '#FAF7F2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div className="lm-logo-ambient-wrap" style={{ marginBottom: '20px' }}>
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(251, 195, 36, 0.1)',
            border: '1px solid rgba(251, 195, 36, 0.3)',
            borderRadius: '999px',
            padding: '6px 16px',
            color: '#FBC324',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: '14px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#FBC324',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
          <span>VERIFYING CUSTOMER SESSION</span>
        </div>
        <p style={{ color: '#9C8C7E', fontSize: '13px', margin: 0, maxWidth: '280px' }}>
          Connecting to Little Monkey Café authentication service...
        </p>
      </div>
    );
  }

  // 2. Strict 30-Minute Dining Session Expiry Gate (Scenario F)
  if (isSessionExpired) {
    return <DiningSessionExpiredGate />;
  }

  // 3. Mandatory Table QR Scan Gate (Scenarios A, B, C, D)
  // Direct URL, copied URL, incognito without valid QR cred are strictly blocked!
  if (isQrRequired || !isQrAuthorized) {
    return <TableQrRequiredGate />;
  }

  // 4. Login-First Gate: Customer MUST authenticate before accessing menu
  if (!customer) {
    return <CustomerLoginGate />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        color: '#FAF7F2',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }}
    >
      {/* 1. Compact Dining Header */}
      <CompactHeader onSearchClick={() => setIsSearchOpen(true)} />

      {/* Revoked Table Alert Banner */}
      {isTableRevoked && (
        <div
          style={{
            background: 'linear-gradient(90deg, #7F1D1D 0%, #991B1B 100%)',
            color: '#FEE2E2',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            position: 'sticky',
            top: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <AlertTriangle size={17} style={{ color: '#FEE2E2', flexShrink: 0 }} />
          <span>
            {tableRevocationReason || `Table ${tableNumber} QR has been deactivated by café administration. Orders cannot be placed at this table.`}
          </span>
        </div>
      )}

      {/* 2. Customer Authentication Gate (Section 5) */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen || (!customer && false)} // open when requested or first visit if mandatory
        onClose={closeAuthModal}
        mandatory={false}
      />

      {/* 3. Main Content Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 3A. Hero Carousel — The Defining Visual Feature (Section 7) */}
        <HeroCarousel
          products={products}
          onProductClick={handleProductSelect}
          onExploreClick={handleExploreClick}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        {/* 3B. Scrolling Little Monkey Café Brand Marquee */}
        <BrandMarquee />

        {/* 3C. Signature Specialty Cold Brew Hero Banner */}
        <ColdBrewHeroBanner onProductClick={handleProductSelect} />

        {/* 3C. Must Try Product Rail (Section 9) */}
        <MustTryRail
          products={mustTryProducts}
          onProductClick={handleProductSelect}
        />

        {/* 3C. Main Menu & Category Navigation (Section 10) */}
        <MenuSection
          onProductClick={handleProductSelect}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onOpenCategorySheet={handleOpenCategorySheet}
        />

        {/* 3D. Verified Guest Feedback & Customer Reviews */}
        <EditorialReviews />
      </main>

      {/* 4. Category Bottom Sheet / Modal Experience */}
      <CategorySheetModal
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        activeCategoryId={activeCategorySheetId}
        onSelectCategory={(id) => {
          setActiveCategorySheetId(id);
          setSelectedCategoryId(id);
        }}
        onProductClick={handleProductSelect}
      />

      {/* 5. Product Details Modal / Sheet (Section 11) */}
      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* 5. Floating Bottom Navigation (Section 12) */}
      <FloatingNavigation
        onMenuClick={handleExploreClick}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* 6. Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleProductSelect}
      />

      {/* 7. Admin QR Management Modal */}
      <AdminQrManagementModal
        isOpen={isAdminModalOpen}
        onClose={closeAdminModal}
      />

      {/* 8. Minimalist Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#050505',
          padding: '24px 20px 90px 20px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#9C8C7E',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <img
            src="/branding/little-monkey-logo-nav.png"
            alt="Little Monkey"
            style={{ width: '20px', height: 'auto', opacity: 0.7 }}
          />
          <span style={{ fontWeight: 700, color: '#FAF7F2' }}>Little Monkey Café</span>
        </div>
        <p style={{ margin: '0 0 4px 0' }}>
          In-Café Digital Dining • {tableNumber} • Authentic Handcrafted Menu
        </p>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)' }}>
          © 2019–Present Little Monkey Café. All rights reserved.
        </p>
        <p style={{ margin: '4px 0 0', fontStyle: 'italic', fontSize: '11.5px', color: '#B8B3A8' }}>
          Good Food. Great Coffee. A Little More Joy.
        </p>
      </footer>
    </div>
  );
};

const VALID_DINE_IN_PATHS = ['/', '/index.html', '/dinein.html', '/menu', '/dining', '/dine-in'];

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const normalized = (currentPath || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const is404 = !VALID_DINE_IN_PATHS.includes(normalized);

  if (is404) {
    return (
      <NotFoundPage
        onBackToHome={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
            setCurrentPath('/');
          }
        }}
        onGoBack={() => {
          if (typeof window !== 'undefined') {
            if (window.history && window.history.length > 1) {
              window.history.back();
            } else {
              window.history.pushState({}, '', '/');
              setCurrentPath('/');
            }
          }
        }}
      />
    );
  }

  return (
    <DineInProvider>
      <DiningAppContent />
    </DineInProvider>
  );
};

export default App;
