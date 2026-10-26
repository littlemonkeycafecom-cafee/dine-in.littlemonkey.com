import React, { useState } from 'react';
import { DineInProvider, useDineIn } from './contexts/DineInContext';
import { ALL_PRODUCTS, getMustTryProducts } from './services/catalog';
import { CompactHeader } from './components/CompactHeader';
import { HeroCarousel } from './components/HeroCarousel';
import { BrandMarquee } from './components/BrandMarquee';
import { MustTryRail } from './components/MustTryRail';
import { MenuSection } from './components/MenuSection';
import { EditorialReviews } from './components/EditorialReviews';
import { ProductDetailsModal } from './components/ProductDetailsModal';
import { CartDrawer } from './components/CartDrawer';
import { FloatingNavigation } from './components/FloatingNavigation';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerLoginGate } from './components/CustomerLoginGate';
import { SearchModal } from './components/SearchModal';
import { Product } from './types';

const DiningAppContent: React.FC = () => {
  const {
    customer,
    isValidatingAuth,
    tableNumber,
    isAuthModalOpen,
    closeAuthModal,
    selectedProduct,
    setSelectedProduct,
  } = useDineIn();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  const mustTryProducts = getMustTryProducts();

  const handleExploreClick = () => {
    const el = document.getElementById('main-menu-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const el = document.getElementById('main-menu-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

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

  // 2. Login-First Gate: Customer MUST authenticate before accessing menu
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
          products={ALL_PRODUCTS}
          onProductClick={handleProductSelect}
          onExploreClick={handleExploreClick}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        {/* 3B. Scrolling Little Monkey Café Brand Marquee */}
        <BrandMarquee />

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
        />

        {/* 3D. Verified Guest Feedback & Customer Reviews */}
        <EditorialReviews />
      </main>

      {/* 4. Product Details Modal / Sheet (Section 11) */}
      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* 5. Cart Drawer & Bill Summary (Section 11) */}
      <CartDrawer />

      {/* 6. Floating Bottom Navigation & Floating Checkout Bar (Section 12) */}
      <FloatingNavigation onMenuClick={handleExploreClick} />

      {/* 7. Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleProductSelect}
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
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.25)' }}>
          © {new Date().getFullYear()} Little Monkey Café. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <DineInProvider>
      <DiningAppContent />
    </DineInProvider>
  );
};

export default App;
