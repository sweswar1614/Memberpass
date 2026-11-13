import { useState } from 'react';
import { authApi, setAuthToken, setStoredUser } from '../services/api';

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await authApi.login(formData.email, formData.password);
        if (!res.success) {
          setError(res.message || 'Login failed. Please verify your credentials.');
          setLoading(false);
          return;
        }

        setAuthToken(res.token);
        setStoredUser(res.user);
        setSuccessMsg('Welcome back to MemberPass!');
        setTimeout(() => {
          onSuccess(res.user);
          onClose();
        }, 600);
      } else {
        const res = await authApi.signup(
          formData.name,
          formData.email,
          formData.password,
          formData.phone
        );
        if (!res.success) {
          setError(res.message || 'Registration failed. Please check the provided information.');
          setLoading(false);
          return;
        }

        setAuthToken(res.token);
        setStoredUser(res.user);
        setSuccessMsg('Privilege account established successfully!');
        setTimeout(() => {
          onSuccess(res.user);
          onClose();
        }, 600);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('A connection error occurred. Please verify backend service is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (email) => {
    setMode('login');
    setFormData({
      name: '',
      email,
      password: 'MemberPass@123',
      phone: ''
    });
    setError('');
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div
        className="modal-container auth-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="crest-mark crest-sm">
            <span className="crest-monogram">M</span>
            <span className="crest-sparkle">✦</span>
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Practitioner Member Access' : 'Join Our Yoga Sanctuary'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your digital pass, class attendance, and wellness membership.'
              : 'Create your account to unlock seamless class check-ins and membership passes.'}
          </p>

          <div className="auth-tab-switch">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setError('');
              }}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <span className="alert-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert-success" role="status">
            <span className="alert-icon">✦</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name <span className="req">*</span></label>
              <input
                id="auth-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Lady Vivienne Montgomery"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Official Email <span className="req">*</span></label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              placeholder="e.g. arun1@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Secret Password <span className="req">*</span></label>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-phone">Phone Contact (Optional)</label>
              <input
                id="auth-phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 00001"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary btn-block auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner"></span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Authenticate Entry' : 'Complete Registration'}</span>
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Buttons for Examiners & Testing */}
        <div className="auth-demo-assist">
          <span className="demo-label">Instant Testing Profiles:</span>
          <div className="demo-buttons">
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleDemoFill('arun1@example.com')}
              title="Active Basic member with 8 classes used"
            >
              Active Member (Arun - 8 classes)
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleDemoFill('janani20@example.com')}
              title="Paused Basic member"
            >
              Paused Member (Janani)
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleDemoFill('karthik3@example.com')}
              title="Active Premium VIP member"
            >
              VIP Member (Karthik)
            </button>
            <button
              type="button"
              className="demo-pill"
              onClick={() => handleDemoFill('m2.staff@example.com')}
              title="Official Staff Account"
            >
              Staff Portal (m2.staff)
            </button>
          </div>
          <span className="demo-hint">Universal Demo Password: MemberPass@123</span>
        </div>
      </div>
    </div>
  );
}

