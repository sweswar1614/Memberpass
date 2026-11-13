import React from 'react';
import { clearAuth } from '../services/api';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MemberPass ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onGoHome) {
      this.props.onGoHome();
    } else {
      window.location.reload();
    }
  };

  handleSignOut = () => {
    clearAuth();
    this.setState({ hasError: false, error: null });
    if (this.props.onLogout) {
      this.props.onLogout();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="member-dashboard-wrap" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#242424',
              border: '1px solid rgba(198, 166, 107, 0.35)',
              borderRadius: '20px',
              padding: '40px 32px',
              color: '#F7F2E9',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 20px',
                borderRadius: '50%',
                backgroundColor: 'rgba(198, 166, 107, 0.12)',
                border: '1px solid rgba(198, 166, 107, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: '#C6A66B'
              }}
            >
              ✦
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#C6A66B',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '10px'
              }}
            >
              Session Protected
            </span>

            <h2
              style={{
                fontSize: '1.6rem',
                fontFamily: 'serif',
                fontWeight: 600,
                color: '#FFFFFF',
                marginBottom: '12px'
              }}
            >
              Dashboard Restored to Safety
            </h2>

            <p
              style={{
                fontSize: '0.95rem',
                color: '#B6A58C',
                lineHeight: 1.6,
                marginBottom: '28px'
              }}
            >
              An unexpected display issue occurred while rendering the dashboard. Your membership data and session remain completely secure.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'center'
              }}
            >
              <button
                className="btn-primary btn-sm"
                onClick={this.handleRetry}
                style={{ cursor: 'pointer' }}
              >
                <span>↻ Reload View</span>
              </button>

              <button
                className="btn-outline btn-sm"
                onClick={this.handleGoHome}
                style={{ cursor: 'pointer' }}
              >
                <span>Return to Home</span>
              </button>

              <button
                className="btn-outline btn-sm"
                onClick={this.handleSignOut}
                style={{ cursor: 'pointer', borderColor: 'rgba(255, 100, 100, 0.4)', color: '#FF9E9E' }}
              >
                <span>Sign Out</span>
              </button>
            </div>

            {this.state.error && (
              <details
                style={{
                  marginTop: '28px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: '#8A857D',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '16px',
                  cursor: 'pointer'
                }}
              >
                <summary style={{ outline: 'none' }}>Technical Diagnostic Info</summary>
                <pre
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: '#1A1A1A',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    color: '#D6BB87',
                    fontFamily: 'monospace'
                  }}
                >
                  {String(this.state.error.message || this.state.error)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

