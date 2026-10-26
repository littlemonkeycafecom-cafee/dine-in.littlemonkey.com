import React, { useState, useEffect } from 'react';
import { Star, MessageSquarePlus, X, CheckCircle2 } from 'lucide-react';
import { useDineIn } from '../contexts/DineInContext';

export interface CustomerReview {
  id: string;
  authorName: string;
  rating: number;
  date: string;
  quote: string;
  isVerifiedDiner: boolean;
}

const INITIAL_REVIEWS: CustomerReview[] = [
  {
    id: 'rev-1',
    authorName: 'Rahul Varma',
    rating: 5,
    date: 'Yesterday',
    quote:
      'The Peri Peri Mexican Pizza and Lotus Biscoff Shake were outstanding! The artisanal crust is crisp, fresh, and full of flavor. Best café ambience in Hanamkonda.',
    isVerifiedDiner: true,
  },
  {
    id: 'rev-2',
    authorName: 'Sneha Reddy',
    rating: 5,
    date: '3 days ago',
    quote:
      'Hands down the finest handcrafted cold brew and chicken burger in the city. The yellow ambient lighting and cozy dining seating make it a regular spot for us.',
    isVerifiedDiner: true,
  },
  {
    id: 'rev-3',
    authorName: 'Dr. K. Karthik',
    rating: 5,
    date: '1 week ago',
    quote:
      'Tried their Boba cold coffee and Truffle fries yesterday. Exceptional quality, fast service right to our table, and the digital ordering was seamless.',
    isVerifiedDiner: true,
  },
  {
    id: 'rev-4',
    authorName: 'Ananya Patel',
    rating: 5,
    date: '2 weeks ago',
    quote:
      'Authentic wood-fired taste on the thin crust pizzas. Delicious dips and warm welcoming staff. Little Monkey Café is a true gem in Warangal & Hanamkonda!',
    isVerifiedDiner: true,
  },
];

export const EditorialReviews: React.FC = () => {
  const { customer } = useDineIn();
  const [reviews, setReviews] = useState<CustomerReview[]>(() => {
    try {
      const stored = localStorage.getItem('lm_customer_reviews');
      if (stored) {
        const parsed = JSON.parse(stored);
        return [...parsed, ...INITIAL_REVIEWS];
      }
    } catch (e) {}
    return INITIAL_REVIEWS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (customer?.name) {
      setAuthorName(customer.name);
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote.trim()) return;

    const newRev: CustomerReview = {
      id: 'rev-' + Date.now(),
      authorName: authorName.trim() || 'Verified Guest',
      rating,
      date: 'Just now',
      quote: quote.trim(),
      isVerifiedDiner: true,
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);

    try {
      const stored = localStorage.getItem('lm_customer_reviews');
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem('lm_customer_reviews', JSON.stringify([newRev, ...existing]));
    } catch (e) {}

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setIsModalOpen(false);
      setQuote('');
    }, 1200);
  };

  return (
    <section className="lm-editorial-reviews" aria-label="Customer Reviews">
      <div className="lm-reviews-container">
        {/* Header */}
        <div className="lm-reviews-header">
          <div>
            <span className="lm-reviews-eyebrow">Verified Dining Voices</span>
            <h2 className="lm-reviews-heading">Guest Feedback & Customer Reviews</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="lm-write-review-btn lm-interactive-btn"
            aria-label="Write a Review"
          >
            <MessageSquarePlus className="lm-review-btn-icon" size={17} />
            <span>Write a Review</span>
          </button>
        </div>

        {/* Reviews Grid */}
        <div className="reviews-grid">
          {reviews.map((rev) => (
            <article key={rev.id} className="review-card">
              <div className="review-stars-row">
                <div className="stars-wrap" aria-label={`${rev.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={`star-icon ${i < rev.rating ? 'filled' : ''}`}
                      style={{
                        color: i < rev.rating ? '#FBC324' : '#383838',
                        fill: i < rev.rating ? '#FBC324' : 'none',
                      }}
                    />
                  ))}
                </div>
                <span className="review-date">{rev.date}</span>
              </div>

              <p className="review-quote">“{rev.quote}”</p>

              <div className="review-author-row">
                <div className="review-avatar">
                  {rev.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="review-author-name">{rev.authorName}</div>
                  {rev.isVerifiedDiner && (
                    <span style={{ fontSize: '10px', color: '#FBC324', fontWeight: 600 }}>
                      Verified Diner
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Write a Review Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#191816',
              border: '1px solid rgba(251, 195, 36, 0.4)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(251, 195, 36, 0.2)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Close review modal"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#FAF7F2',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>

            {isSubmitted ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <CheckCircle2 size={44} style={{ color: '#FBC324', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '18px', color: '#FAF7F2', marginBottom: '6px' }}>Thank You!</h3>
                <p style={{ fontSize: '13px', color: '#9C8C7E' }}>Your review has been published.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3
                  style={{
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: '20px',
                    color: '#FAF7F2',
                    margin: '0 0 4px 0',
                  }}
                >
                  Share Your Experience
                </h3>
                <p style={{ fontSize: '12px', color: '#9C8C7E', margin: '0 0 16px 0' }}>
                  Little Monkey Café Dining • Hanamkonda
                </p>

                {/* Rating selection */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#FAF7F2', marginBottom: '6px', fontWeight: 600 }}>
                    Rating:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setRating(s)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <Star
                          size={24}
                          style={{
                            color: s <= rating ? '#FBC324' : '#383838',
                            fill: s <= rating ? '#FBC324' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#FAF7F2', marginBottom: '6px', fontWeight: 600 }}>
                    Your Name:
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Enter your name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#12100E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FAF7F2',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Quote */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#FAF7F2', marginBottom: '6px', fontWeight: 600 }}>
                    Review / Comments:
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder="Tell us what you enjoyed about the food and ambience..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#12100E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FAF7F2',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="lm-interactive-btn"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: '#FBC324',
                    border: 'none',
                    color: '#080808',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Submit Review
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
