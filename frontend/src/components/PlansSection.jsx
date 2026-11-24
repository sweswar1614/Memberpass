import { useState, useEffect } from 'react';
import { planApi, paymentApi } from '../services/api';

const DEFAULT_PLANS = [
  {
    name: 'Basic',
    price: 1500,
    priceInPaise: 150000,
    durationDays: 30,
    classLimit: 10,
    description: 'Access to regular yoga sessions, class participation tracking, and digital check-ins.',
    features: [
      'Access to regular yoga sessions',
      'Up to 10 classes',
      'Digital QR Membership Pass',
      'Attendance history'
    ]
  },
  {
    name: 'Standard',
    price: 3000,
    priceInPaise: 300000,
    durationDays: 30,
    classLimit: 25,
    description: 'Enhanced tier for dedicated yogis seeking expanded class allocations and priority booking.',
    features: [
      'All Basic benefits',
      'Up to 25 yoga classes',
      'Priority class booking',
      'Wellness progress tracking',
      'Instant QR verification'
    ],
    isFeatured: true
  },
  {
    name: 'Premium',
    price: 7500,
    priceInPaise: 750000,
    durationDays: 90,
    classLimit: null,
    description: 'Complete 90-day immersion with unlimited studio access and private wellness consultations.',
    features: [
      'Unlimited yoga sessions',
      '90-day membership validity',
      'Personal wellness consultation',
      'Premium yoga session access',
      'Priority member support'
    ]
  }
];

const YOGA_PLAN_EXTRAS = {
  Basic: {
    description: 'Access to regular yoga sessions, class participation tracking, and digital check-ins.',
    features: [
      'Access to regular yoga sessions',
      'Up to 10 classes',
      'Digital QR Membership Pass',
      'Attendance history'
    ]
  },
  Standard: {
    description: 'Enhanced tier for dedicated yogis seeking expanded class allocations and priority booking.',
    features: [
      'All Basic benefits',
      'Up to 25 yoga classes',
      'Priority class booking',
      'Wellness progress tracking',
      'Instant QR verification'
    ]
  },
  Premium: {
    description: 'Complete 90-day immersion with unlimited studio access and private wellness consultations.',
    features: [
      'Unlimited yoga sessions',
      '90-day membership validity',
      'Personal wellness consultation',
      'Premium yoga session access',
      'Priority member support'
    ]
  }
};

export default function PlansSection({ currentUser, onRequireAuth, onPaymentSuccess }) {
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [razorpayNotice, setRazorpayNotice] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await planApi.getPlans();
      if (res && res.success && res.plans && res.plans.length > 0) {
        const enhancedPlans = res.plans.map((p) => ({
          ...p,
          description: YOGA_PLAN_EXTRAS[p.name]?.description || p.description,
          features: YOGA_PLAN_EXTRAS[p.name]?.features || p.features
        }));
        setPlans(enhancedPlans);
      }
    } catch (err) {
      console.warn('Using default plans fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSelectPlan = async (plan) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    setSelectedPlan(plan);
    setProcessingPayment(true);
    setRazorpayNotice(null);

    try {
      // 1. Create order on backend
      const orderRes = await paymentApi.createOrder(plan._id, plan.name);

      if (!orderRes.success) {
        if (orderRes.code === 'RAZORPAY_KEYS_MISSING') {
          setRazorpayNotice({
            type: 'config',
            title: 'Razorpay Gateway Notice',
            message:
              'Razorpay API Keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in backend/.env. To enable live Razorpay checkout, please set your test credentials in the backend environment file.'
          });
        } else {
          setRazorpayNotice({
            type: 'error',
            title: 'Order Creation Failed',
            message: orderRes.message || 'Unable to initiate payment order.'
          });
        }
        setProcessingPayment(false);
        return;
      }

      // 2. Ensure Razorpay checkout script is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setRazorpayNotice({
          type: 'error',
          title: 'Gateway Unavailable',
          message: 'Failed to load the Razorpay checkout SDK. Please verify internet connectivity.'
        });
        setProcessingPayment(false);
        return;
      }

      // 3. Open Razorpay checkout modal
      const options = {
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'MemberPass – Yoga & Wellness',
        description: `${plan.name} Membership Plan`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: orderRes.orderId,
        handler: async (response) => {
          try {
            // 4. Verify payment on backend with HMAC-SHA256
            const verifyRes = await paymentApi.verifyPayment({
              paymentRecordId: orderRes.paymentRecordId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.success) {
              onPaymentSuccess({
                plan: plan.name,
                membership: verifyRes.membership,
                paymentId: response.razorpay_payment_id
              });
            } else {
              setRazorpayNotice({
                type: 'error',
                title: 'Verification Failed',
                message: verifyRes.message || 'Payment verification could not be validated.'
              });
            }
          } catch (verErr) {
            console.error('Payment verification error:', verErr);
            setRazorpayNotice({
              type: 'error',
              title: 'Verification Error',
              message: 'An error occurred while verifying the payment with the backend.'
            });
          } finally {
            setProcessingPayment(false);
          }
        },
        prefill: {
          name: currentUser.name || '',
          email: currentUser.email || '',
          contact: currentUser.phone || ''
        },
        theme: {
          color: '#6D1835'
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (failRes) {
        setRazorpayNotice({
          type: 'error',
          title: 'Payment Incomplete',
          message: failRes.error ? failRes.error.description : 'Payment could not be completed.'
        });
        setProcessingPayment(false);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Payment initiation error:', err);
      setRazorpayNotice({
        type: 'error',
        title: 'Error',
        message: 'A communication error occurred while contacting the payment service.'
      });
      setProcessingPayment(false);
    }
  };

  return (
    <section className="section-padding plans-section" id="plans">
      <div className="section-header text-center">
        <span className="section-kicker">MEMBERSHIP PLANS</span>
        <h2 className="section-heading">Choose Your Wellness Membership</h2>
        <p className="section-subtext">
          Transparent, flexible yoga membership plans tailored to your practice, class attendance, and wellness goals.
        </p>
      </div>

      {/* Razorpay Configuration Alert Modal / Box */}
      {razorpayNotice && (
        <div className="razorpay-notice-box fade-in">
          <div className="notice-icon">
            {razorpayNotice.type === 'config' ? '⚙' : '⚠'}
          </div>
          <div className="notice-content">
            <h4>{razorpayNotice.title}</h4>
            <p>{razorpayNotice.message}</p>
          </div>
          <button
            className="notice-close"
            onClick={() => setRazorpayNotice(null)}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      <div className="plans-triptych-grid">
        {plans.map((plan) => {
          const isStandard = plan.name === 'Standard';
          const isPremium = plan.name === 'Premium';

          return (
            <div
              key={plan._id || plan.name}
              className={`plan-card ${isStandard ? 'featured-plan' : ''}`}
            >
              {isStandard && (
                <div className="featured-ribbon">
                  <span>✦ MOST POPULAR TIER ✦</span>
                </div>
              )}

              <div className="plan-header">
                <span className="plan-kicker">
                  {plan.name === 'Basic' ? 'TIER I' : isStandard ? 'TIER II' : 'TIER III'}
                </span>
                <h3 className="plan-name">{plan.name} Plan</h3>
                <p className="plan-subtitle">{plan.description}</p>
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">
                    {(plan.price || plan.priceInPaise / 100).toLocaleString('en-IN')}
                  </span>
                  <span className="period">/ {plan.durationDays} Days</span>
                </div>
              </div>

              <div className="plan-meta-specs">
                <div className="spec-row">
                  <span className="spec-label">VALIDITY</span>
                  <strong className="spec-value">{plan.durationDays} Days Dedicated</strong>
                </div>
                <div className="spec-row">
                  <span className="spec-label">CLASSES / LIMIT</span>
                  <strong className="spec-value">
                    {plan.classLimit !== null ? `${plan.classLimit} Yoga Classes Included` : 'Unlimited Yoga Sessions'}
                  </strong>
                </div>
              </div>

              <div className="plan-features-list">
                {(plan.features || []).map((feat, idx) => (
                  <div key={idx} className="feature-item">
                    <span className="check-rose">✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                className={`btn-plan ${isStandard ? 'btn-plan-featured' : 'btn-plan-outline'}`}
                onClick={() => handleSelectPlan(plan)}
                disabled={processingPayment && selectedPlan?.name === plan.name}
              >
                {processingPayment && selectedPlan?.name === plan.name ? (
                  <span>Initiating Gateway...</span>
                ) : (
                  <span>{currentUser ? `Subscribe ${plan.name}` : `Claim ${plan.name} Pass`}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

