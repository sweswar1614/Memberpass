import { useState, useEffect } from 'react';
import { memberApi } from '../services/api';

export default function MemberDashboard({
  currentUser: _currentUser,
  onLogout: _onLogout,
  onNavigateToPlans,
  onOpenQRModal: _onOpenQRModal
}) {
  const [profile, setProfile] = useState(null);
  const [passData, setPassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [profRes, passRes] = await Promise.all([
        memberApi.getProfile(),
        memberApi.getPass()
      ]);

      if (profRes && profRes.success) {
        setProfile(profRes.member);
      } else {
        setError(profRes?.message || 'Failed to load member profile');
      }

      if (passRes && passRes.success) {
        setPassData(passRes);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Communication error loading membership telemetry');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceHistory = async () => {
    try {
      setAttendanceLoading(true);
      setAttendanceError('');

      const result = await memberApi.getAttendanceHistory();

      if (result.success) {
        setAttendanceHistory(result.history || []);
      } else {
        setAttendanceError(result.message || 'Unable to load attendance history');
      }
    } catch (err) {
      console.error('Attendance history error:', err);
      setAttendanceError('Unable to connect to server');
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profRes, passRes] = await Promise.all([
          memberApi.getProfile(),
          memberApi.getPass()
        ]);
        if (active) {
          if (profRes && profRes.success) {
            setProfile(profRes.member);
          } else {
            setError(profRes?.message || 'Failed to load member profile');
          }
          if (passRes && passRes.success) {
            setPassData(passRes);
          }
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error('Error loading dashboard data:', err);
          setError('Communication error loading membership telemetry');
          setLoading(false);
        }
      }
      try {
        const result = await memberApi.getAttendanceHistory();
        if (active) {
          if (result.success) {
            setAttendanceHistory(result.history || []);
          } else {
            setAttendanceError(result.message || 'Unable to load attendance history');
          }
          setAttendanceLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error('Attendance history error:', err);
          setAttendanceError('Unable to connect to server');
          setAttendanceLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyPassCode = () => {
    if (profile?.passCode) {
      navigator.clipboard.writeText(profile.passCode);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    const qrUrl = passData?.pass?.qrCode;
    if (!qrUrl) return;

    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `MemberPass-${(profile?.name || 'card').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="dashboard-loading-state">
        <div className="crest-spinner"></div>
        <p>Retrieving sovereign membership credentials...</p>
      </div>
    );
  }

  const membership = profile?.membership;
  const status = profile?.membershipStatus || 'none';
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended';

  return (
    <div className="member-dashboard-wrap">
      {/* Toast Notification */}
      {copyToast && (
        <div className="dashboard-toast fade-in">
          <span>✦ Cryptographic Pass Code Copied to Clipboard</span>
        </div>
      )}

      {/* Dashboard Top Banner */}
      <div className="dashboard-banner">
        <div className="banner-left">
          <div className="member-avatar-lg">
            <span>{(profile?.name || 'M').slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="banner-text">
            <div className="banner-eyebrow">
              <span className="crest-sparkle">✦</span>
              <span>AUTHENTICATED YOGA PRACTITIONER</span>
            </div>
            <h1 className="banner-heading">Welcome back, {profile?.name}</h1>
            <p className="banner-email">{profile?.email} • Member ID: {profile?.id?.slice(-8)}</p>
          </div>
        </div>

        <div className="banner-actions">
          <button className="btn-outline btn-sm" onClick={loadDashboardData} title="Refresh telemetry">
            <span>↻ Refresh Data</span>
          </button>
          <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
            <span>Upgrade / Renew Plan</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="dashboard-alert alert-danger fade-in">
          <span className="alert-symbol">⚠</span>
          <div>
            <strong>Notice</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Main Metric Cards Grid */}
      <div className="dashboard-metrics-grid">
        {/* Metric 1: Membership Status */}
        <div className="metric-box">
          <span className="metric-kicker">MEMBERSHIP STANDING</span>
          <div className="metric-status-row">
            <span
              className={`status-indicator-badge badge-${status}`}
            >
              <span className="status-dot"></span>
              {status.toUpperCase()}
            </span>
          </div>
          <p className="metric-note">
            {isActive
              ? 'Authorized for immediate yoga studio & class entry'
              : isPaused
                ? 'Membership paused. Studio access suspended'
                : isEnded
                  ? 'Membership expired. Renewal required'
                  : 'No active plan registered'}
          </p>
        </div>

        {/* Metric 2: Current Tier */}
        <div className="metric-box">
          <span className="metric-kicker">PRIVILEGE TIER</span>
          <h3 className="metric-value">{membership?.plan?.name || 'Standard Tier'}</h3>
          <p className="metric-note">
            {membership
              ? `Valid through ${new Date(membership.endDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}`
              : 'Select a plan to activate privileges'}
          </p>
        </div>

        {/* Metric 3: Class Limit & Usage */}
        <div className="metric-box">
          <span className="metric-kicker">CLASS UTILIZATION</span>
          <div className="metric-classes-row">
            <span className="metric-value">
              {membership?.classesUsed || 0}
              <span className="metric-sub">
                {membership?.plan?.classLimit !== null && membership?.plan?.classLimit !== undefined
                  ? ` / ${membership.plan.classLimit} Classes`
                  : ' / Unlimited'}
              </span>
            </span>
          </div>
          <p className="metric-note">
            {membership?.classesRemaining !== undefined
              ? `Remaining: ${membership.classesRemaining} sessions`
              : 'Masterclasses & wellness sessions'}
          </p>
        </div>

        {/* Metric 4: Cryptographic Pass Code */}
        <div className="metric-box">
          <span className="metric-kicker">PASS CODE (CRYPTOGRAPHIC)</span>
          <div className="pass-code-display" onClick={handleCopyPassCode} title="Click to copy pass code">
            <code>
              {profile?.passCode
                ? `${profile.passCode.slice(0, 12)}••••${profile.passCode.slice(-6)}`
                : 'GENERATING...'}
            </code>
            <span className="copy-icon">⎘</span>
          </div>
          <p className="metric-note">256-bit unique cryptographic pass key</p>
        </div>
      </div>

      {/* Membership State Alerts */}
      {isPaused && (
        <div className="dashboard-alert alert-warning fade-in">
          <span className="alert-symbol">⏸</span>
          <div>
            <strong>Membership On Hold</strong>
            <p>
              Your membership pass is paused. Facility gate verification is temporarily inactive.
              Please connect with the front desk to resume full privileges.
            </p>
          </div>
        </div>
      )}

      {isEnded && (
        <div className="dashboard-alert alert-danger fade-in">
          <span className="alert-symbol">⚠</span>
          <div>
            <strong>Membership Expired</strong>
            <p>
              Your membership validity has concluded. Please select a renewed plan to reactivate your digital pass and enjoy uninterrupted access.
            </p>
          </div>
          <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
            Renew Now
          </button>
        </div>
      )}

      {/* Pass Card Stage */}
      <div className="dashboard-content-split">
        {/* Left Column: Digital Membership Pass Card */}
        <div className="pass-preview-column">
          <div className="section-sub-header">
            <h3>Digital Membership Pass</h3>
            <p>Present at the studio check-in terminal for instant optical validation.</p>
          </div>

          <div className="card-stage dashboard-card-stage">
            <div className={`digital-pass-card ${isPaused ? 'card-paused' : ''} ${isEnded ? 'card-ended' : ''}`}>
              <div className="card-watermark" aria-hidden="true"></div>

              {/* Pass Top */}
              <div className="pass-card-top">
                <div className="pass-crest">
                  <span className="crest-symbol">M</span>
                  <div className="crest-details">
                    <span className="crest-title">MEMBERPASS</span>
                    <span className="crest-sub">YOGA &amp; WELLNESS SANCTUARY</span>
                  </div>
                </div>

                <div className="pass-status-pill">
                  <span className={`status-pulse ${isActive ? 'pulse-active' : 'pulse-inactive'}`}></span>
                  <span>{status.toUpperCase()}</span>
                </div>
              </div>

              {/* Pass Tier Ribbon */}
              <div className="pass-tier-ribbon">
                <span className="ribbon-sparkle">✦</span>
                <span className="ribbon-text">
                  {membership?.plan?.name ? `${membership.plan.name.toUpperCase()} YOGA PASS` : 'YOGA PRACTITIONER'}
                </span>
              </div>

              {/* Member Profile */}
              <div className="pass-member-profile">
                <div className="pass-avatar">
                  <span>{(profile?.name || 'M').slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="member-meta">
                  <h3 className="member-name">{profile?.name}</h3>
                  <p className="member-role">Verified Yoga Member</p>
                  <code className="pass-code">CODE: {profile?.passCode?.slice(0, 16)}...</code>
                </div>
              </div>

              {/* Divider */}
              <div className="card-ornament-divider">
                <div className="divider-line"></div>
                <span className="divider-diamond">✦</span>
                <div className="divider-line"></div>
              </div>

              {/* QR Code Area */}
              <div className="pass-qr-container">
                {isActive && passData?.pass?.qrCode ? (
                  <div className="qr-wrapper">
                    <img
                      src={passData.pass.qrCode}
                      alt="Digital Membership QR Code"
                      className="qr-image"
                    />
                    <div className="qr-scan-badge">
                      <span className="scan-icon">⊡</span>
                      <span>Scan for Instant Studio Check-In</span>
                    </div>
                  </div>
                ) : (
                  <div className="qr-disabled-placeholder">
                    <span className="qr-disabled-icon">{isPaused ? '⏸' : '✕'}</span>
                    <p>
                      {isPaused
                        ? 'Pass Paused • Studio Check-In Disabled'
                        : isEnded
                          ? 'Pass Expired • Please Renew Plan'
                          : 'No Active Membership'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pass Bottom Details */}
              <div className="pass-card-bottom">
                <div className="bottom-col">
                  <span className="label">EXPIRY DATE</span>
                  <span className="value">
                    {membership?.endDate
                      ? new Date(membership.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                      : 'N/A'}
                  </span>
                </div>

                <div className="bottom-col text-right">
                  <span className="label">CLASSES USED</span>
                  <span className="value">
                    {membership?.classesUsed ?? 0} {membership?.plan?.classLimit ? `/ ${membership.plan.classLimit}` : 'Used'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pass Action Buttons */}
          <div className="pass-actions-row">
            {isActive && passData?.pass?.qrCode && (
              <button className="btn-primary btn-sm" onClick={handleDownloadQR}>
                <span>Download Pass (PNG)</span>
                <span className="btn-arrow">↓</span>
              </button>
            )}
            <button className="btn-outline btn-sm" onClick={onOpenQRModal}>
              <span>Full-Screen Scanner View</span>
              <span className="btn-arrow">↗</span>
            </button>
          </div>
        </div>

        {/* Right Column: Transaction & Attendance Records */}
        <div className="dashboard-records-column">
          {/* Transaction & Payment History */}
          <div className="payments-history-column">
            <div className="section-sub-header">
              <h3>Privilege Transactions</h3>
              <p>Verified ledger of subscription and membership payments.</p>
            </div>

            <div className="payment-history-card">
              {profile?.recentPayments && profile.recentPayments.length > 0 ? (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Order Reference</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.recentPayments.map((p) => (
                        <tr key={p.id || p.orderId}>
                          <td>
                            <strong>{p.planName}</strong>
                          </td>
                          <td>
                            <code className="order-ref">{p.orderId?.slice(-10) || p.id?.slice(-8)}</code>
                          </td>
                          <td>
                            {new Date(p.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </td>
                          <td className="amount-col">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                          <td>
                            <span className={`payment-status-badge ${p.status}`}>
                              {p.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-payments-placeholder">
                  <span className="placeholder-icon">✦</span>
                  <p>No prior payment records located on this account.</p>
                  <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
                    Select a Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Member Attendance History */}
          <div className="payments-history-column member-attendance-section">
            <div className="section-sub-header section-header-split">
              <div>
                <h3>My Attendance History</h3>
                <p>Your personal yoga class check-in records.</p>
              </div>
              <button
                className="btn-outline btn-sm"
                onClick={loadAttendanceHistory}
                disabled={attendanceLoading}
                title="Refresh attendance records"
              >
                {attendanceLoading ? 'Refreshing...' : '↻ Refresh Attendance'}
              </button>
            </div>

            <div className="payment-history-card">
              {attendanceError && (
                <div className="staff-message">{attendanceError}</div>
              )}

              {attendanceLoading && attendanceHistory.length === 0 ? (
                <div className="no-payments-placeholder">
                  <p>Loading your attendance records...</p>
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="no-payments-placeholder">
                  <span className="placeholder-icon">✦</span>
                  <p>No class attendance records found yet.</p>
                </div>
              ) : (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Staff</th>
                        <th>Check-in Date</th>
                        <th>Check-in Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((record) => (
                        <tr key={record.id}>
                          <td><strong>{record.planName}</strong></td>
                          <td>{record.staffName}</td>
                          <td>
                            {new Date(record.checkedInAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td>
                            {new Date(record.checkedInAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

