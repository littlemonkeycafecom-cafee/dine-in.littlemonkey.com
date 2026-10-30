import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { LiquidWaveTransition } from './LiquidWaveTransition';
import { CustomScrollbarContainer } from './CustomScrollbarContainer';

export const CartDrawer: React.FC = () => {
  const {
    isCartDrawerOpen,
    closeCart,
    cart,
    cartCount,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
    tableNumber,
    placeDineInOrder,
    isTableRevoked,
    tableRevocationReason,
  } = useDineIn();

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placedOrderInfo, setPlacedOrderInfo] = useState<any>(null);

  if (!isCartDrawerOpen) return null;

  const gst = Math.round(cartSubtotal * 0.05);
  const grandTotal = cartSubtotal + gst;

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setOrderError(null);
    try {
      const result = await placeDineInOrder();
      setPlacedOrderInfo(result);
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#FBC324', '#FAF7F2', '#10B981'],
      });
      setOrderPlaced(true);
      clearCart();
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to submit order. Please check availability and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAfterSuccess = () => {
    setOrderPlaced(false);
    setPlacedOrderInfo(null);
    closeCart();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={closeCart}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          backgroundColor: '#12100E',
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          border: '1px solid rgba(251, 195, 36, 0.25)',
          borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Organic Liquid Wave Reveal Animation (1023.mp4) */}
        <LiquidWaveTransition isActive={isCartDrawerOpen} />

        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: '#191816',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(251, 195, 36, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FBC324',
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FAF7F2', margin: 0 }}>
                Your Dine-In Order
              </h2>
              <span style={{ fontSize: '11px', color: '#9C8C7E' }}>
                {tableNumber} • {cartCount} {cartCount === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!orderPlaced && cart.length > 0 && (
              <button
                onClick={clearCart}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9C8C7E',
                  fontSize: '11px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  padding: '4px 8px',
                }}
              >
                Clear All
              </button>
            )}
            <button
              onClick={orderPlaced ? handleCloseAfterSuccess : closeCart}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FAF7F2',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {orderPlaced ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={58} style={{ color: '#22C55E', marginBottom: '16px' }} />
            <div
              style={{
                display: 'inline-block',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '999px',
                padding: '4px 14px',
                color: '#4ADE80',
                fontSize: '11.5px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                marginBottom: '12px',
              }}
            >
              ORDER #{placedOrderInfo?.orderNumber || 'CONFIRMED'} • {placedOrderInfo?.tableNumber || tableNumber}
            </div>
            <h3
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '24px',
                color: '#FAF7F2',
                margin: '0 0 10px 0',
              }}
            >
              Order Placed for {placedOrderInfo?.tableNumber || tableNumber}!
            </h3>
            <p style={{ fontSize: '13px', color: '#9C8C7E', maxWidth: '340px', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              Your order has been sent directly to the Little Monkey kitchen. Please relax at your table while we prepare your fresh bites.
            </p>
            {placedOrderInfo?.total && (
              <div
                style={{
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  color: '#FAF7F2',
                  fontSize: '13px',
                  marginBottom: '24px',
                }}
              >
                <span style={{ color: '#9C8C7E' }}>Billed Amount: </span>
                <span style={{ fontWeight: 800, color: '#FBC324' }}>₹{placedOrderInfo.total}</span>
                <span style={{ color: '#9C8C7E', fontSize: '11px', marginLeft: '6px' }}>(Pay at Counter / Table)</span>
              </div>
            )}
            <button
              onClick={handleCloseAfterSuccess}
              className="lm-interactive-btn"
              style={{
                padding: '12px 28px',
                backgroundColor: '#FBC324',
                color: '#080808',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              CONTINUE BROWSING MENU
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#191816',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9C8C7E',
                marginBottom: '16px',
              }}
            >
              <ShoppingBag size={28} />
            </div>
            <h3 style={{ fontSize: '17px', color: '#FAF7F2', margin: '0 0 6px 0', fontWeight: 700 }}>
              Your tray is currently empty
            </h3>
            <p style={{ fontSize: '12.5px', color: '#9C8C7E', margin: '0 0 20px 0' }}>
              Add handcrafted pizzas, signature cold brews, or burgers to get started.
            </p>
            <button
              onClick={closeCart}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                backgroundColor: '#FBC324',
                color: '#080808',
                border: 'none',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Explore Menu
            </button>
          </div>
        ) : (
          <>
            {/* Items List with Synchronized Custom Scrollbar */}
            <CustomScrollbarContainer
              style={{ flex: 1, minHeight: 0 }}
              contentStyle={{ padding: '16px 20px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: '#191816',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <div
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: item.product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                          }}
                        />
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', margin: 0 }}>
                          {item.product.name}
                        </h4>
                      </div>

                      <div style={{ fontSize: '11px', color: '#9C8C7E', marginBottom: '4px' }}>
                        {item.selectedVariant.name !== 'Regular' && <span>{item.selectedVariant.name} • </span>}
                        <span>₹{item.unitPrice} each</span>
                        {item.selectedAddons.length > 0 && (
                          <div>
                            + {item.selectedAddons.map((a) => `${a.name} (₹${a.price})`).join(', ')}
                          </div>
                        )}
                        {item.kitchenInstructions && (
                          <div style={{ color: '#FBC324', fontStyle: 'italic', marginTop: '2px' }}>
                            Note: {item.kitchenInstructions}
                          </div>
                        )}
                      </div>

                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#FBC324' }}>
                        ₹{item.totalPrice}
                      </span>
                    </div>

                    {/* Quantity Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#12100E',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          gap: '10px',
                        }}
                      >
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={isSubmitting}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#FAF7F2',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            padding: 0,
                          }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#FAF7F2', minWidth: '16px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isSubmitting}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#FAF7F2',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            padding: 0,
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        disabled={isSubmitting}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          padding: '4px',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CustomScrollbarContainer>

            {/* Bill Summary & Action */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#191816',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Server-Side Error Alert */}
              {orderError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#FCA5A5',
                    fontSize: '12.5px',
                  }}
                >
                  <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                  <span style={{ lineHeight: 1.4 }}>{orderError}</span>
                </div>
              )}

              {isTableRevoked && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#FCA5A5',
                    fontSize: '12.5px',
                  }}
                >
                  <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                  <span style={{ lineHeight: 1.4 }}>
                    {tableRevocationReason || `Table ${tableNumber} QR has been deactivated by café staff. Ordering is disabled.`}
                  </span>
                </div>
              )}

              {/* Summary Lines */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#9C8C7E' }}>
                  <span>Item Subtotal ({cartCount} items)</span>
                  <span style={{ color: '#FAF7F2' }}>₹{cartSubtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#9C8C7E' }}>
                  <span>Café Charges & GST (5%)</span>
                  <span style={{ color: '#FAF7F2' }}>₹{gst}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#22C55E' }}>
                  <span>Dine-In Packaging Fee</span>
                  <span>FREE</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: '8px',
                    marginTop: '2px',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: '#FBC324' }}>₹{grandTotal}</span>
                </div>
              </div>

              {/* Confirm Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting || isTableRevoked}
                className="lm-interactive-btn"
                style={{
                  width: '100%',
                  backgroundColor: isTableRevoked ? '#242424' : isSubmitting ? '#A37E15' : '#FBC324',
                  color: isTableRevoked ? '#737373' : '#080808',
                  border: isTableRevoked ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: isTableRevoked ? 'not-allowed' : isSubmitting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isTableRevoked ? 'none' : '0 4px 16px rgba(251, 195, 36, 0.25)',
                  opacity: isSubmitting ? 0.8 : 1,
                }}
              >
                {isTableRevoked ? (
                  <span>TABLE QR DEACTIVATED</span>
                ) : isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>TRANSMITTING TO KITCHEN...</span>
                  </>
                ) : (
                  <>
                    <span>CONFIRM DINE-IN ORDER</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
