import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { ALL_PRODUCTS, getBasePrice } from '../services/catalog';
import { Search, X } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? ALL_PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 16)
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#12100E',
          border: '1px solid rgba(251, 195, 36, 0.25)',
          borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            padding: '16px 18px',
            backgroundColor: '#191816',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Search size={18} style={{ color: '#FBC324', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pizza, burger, frappe, coffee..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FAF7F2',
              fontSize: '15px',
              outline: 'none',
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#9C8C7E',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#9C8C7E',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
          {query.trim() === '' ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9C8C7E', fontSize: '13px' }}>
              Type a dish or ingredient name to search 184 authentic Little Monkey dishes.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9C8C7E', fontSize: '13px' }}>
              No dishes found matching "{query}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map((product) => {
                const price = getBasePrice(product);
                return (
                  <div
                    key={product.slug}
                    onClick={() => {
                      onSelectProduct(product);
                      onClose();
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#191816',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(251, 195, 36, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <div
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                          }}
                        />
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', margin: 0 }}>
                          {product.name}
                        </h4>
                      </div>
                      <p
                        style={{
                          fontSize: '11px',
                          color: '#9C8C7E',
                          margin: 0,
                          maxWidth: '380px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {product.description}
                      </p>
                    </div>

                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#FBC324', marginLeft: '12px' }}>
                      ₹{price}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
