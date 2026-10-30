import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { getBasePrice } from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
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
  const { isVegOnly, toggleVegOnly, products } = useDineIn();
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
    ? products
        .filter((p) => {
          if (isVegOnly && p.dietary_classification !== 'VEG') return false;
          const q = query.toLowerCase();
          const matchName = (p.name || '').toLowerCase().includes(q);
          const matchDesc = (p.description || '').toLowerCase().includes(q);
          const matchCat = (p.category || '').toLowerCase().includes(q);
          return matchName || matchDesc || matchCat;
        })
        .slice(0, 16)
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '540px',
          backgroundColor: '#080808',
          border: '1px solid #242424',
          borderRadius: '10px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.95)',
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
            padding: '12px 16px',
            backgroundColor: '#111111',
            borderBottom: '1px solid #1E1E1E',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Search size={18} style={{ color: '#FFC21A', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isVegOnly
                ? 'Search veg dishes (pizza, pasta, cold brew...)'
                : 'Search pizza, burger, frappe, coffee...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#F5F5F5',
              fontSize: '14px',
              outline: 'none',
            }}
          />

          {/* Veg Only Quick Filter Pill inside Search */}
          <button
            type="button"
            onClick={toggleVegOnly}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              borderRadius: '999px',
              backgroundColor: isVegOnly ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: isVegOnly ? '1px solid #22C55E' : '1px solid #333333',
              color: isVegOnly ? '#22C55E' : '#888888',
              fontSize: '10.5px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isVegOnly ? '#22C55E' : '#666666',
              }}
            />
            <span>Veg</span>
          </button>

          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#888888',
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
                color: '#888888',
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
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#666666', fontSize: '12.5px' }}>
              Type a dish or ingredient name to search {isVegOnly ? 'vegetarian ' : ''}dishes.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#888888', fontSize: '12.5px' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                No {isVegOnly ? 'vegetarian ' : ''}dishes found matching "{query}".
              </p>
              {isVegOnly && (
                <button
                  type="button"
                  onClick={toggleVegOnly}
                  style={{
                    backgroundColor: '#111111',
                    border: '1px solid #FFC21A',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#FFC21A',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Include Non-Veg Results
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#111111',
                      border: '1px solid #1E1E1E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#FFC21A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#1E1E1E';
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
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#F5F5F5', margin: 0 }}>
                          {product.name}
                        </h4>
                      </div>
                      <p
                        style={{
                          fontSize: '11px',
                          color: '#888888',
                          margin: 0,
                          maxWidth: '360px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {product.description}
                      </p>
                    </div>

                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFC21A', marginLeft: '12px' }}>
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
