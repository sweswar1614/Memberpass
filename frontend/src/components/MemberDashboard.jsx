import { useState, useEffect } from 'react';
import { memberApi } from '../services/api';

const CURRENT_YEAR = new Date().getFullYear();

export default function MemberDashboard({
  currentUser,
  onLogout,
  onNavigateToPlans,
  onOpenQRModal,
  onNavigateAI,
  activeSection: controlledSection,
  onSectionChange: setControlledSection
}) {
  const [profile, setProfile] = useState(null);
  const [passData, setPassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // Internal tab state if not controlled from parent
  const [internalTab, setInternalTab] = useState('overview');
  const activeTab = controlledSection || internalTab;

  const handleTabClick = (tabKey) => {
    if (tabKey === 'ai') {
      if (onNavigateAI) onNavigateAI();
      return;
    }
    if (setControlledSection) {
      setControlledSection(tabKey);
    } else {
      setInternalTab(tabKey);
    }
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Membership pause states
  const [pauseDays, setPauseDays] = useState('7');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');
  const [pauseError, setPauseError] = useState('');

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

      if (result && result.success) {
        setAttendanceHistory(result.history || []);
      } else {
        setAttendanceError(result?.message || 'Unable to load attendance history');
      }
    } catch (err) {
      console.error('Attendance history error:', err);
      setAttendanceError('Unable to connect to server');
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadAttendanceHistory();
  }, []);

  const handlePauseMembership = async (event) => {
    event.preventDefault();
    const days = Number(pauseDays);

    if (!Number.isInteger(days) || days < 1 || days > 15) {
      setPauseError('Please select a pause duration between 1 and 15 days.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to pause your membership for ${days} day(s)? Your membership expiry date will be extended by ${days} day(s).`
    );

    if (!confirmed) return;

    try {
      setPauseLoading(true);
      setPauseError('');
      setPauseMessage('');

      const result = await memberApi.pauseMembership(days);

      if (!result || !result.success) {
        setPauseError(result?.message || 'Unable to pause membership.');
        return;
      }

      setPauseMessage(
        result.message || `Your membership has been paused for ${days} day(s).`
      );

      await loadDashboardData();
    } catch (err) {
      console.error('Membership pause request error:', err);
      setPauseError('Unable to connect to the server. Please try again.');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleCopyPassCode = () => {
    const code = profile?.passCode || currentUser?.passCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    const qrUrl = passData?.pass?.qrCode;
    if (!qrUrl) return;

    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `MemberPass-${(profile?.name || currentUser?.name || 'sanctuary-pass').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !profile) {
    return (
      <div className="member-dashboard-wrap">
        <div className="dashboard-loading-state zen-loading-state">
          <div className="crest-spinner"></div>
          <p>Retrieving your serene sanctuary credentials...</p>
        </div>
      </div>
    );
  }

  const membership = profile?.membership;
  const status = profile?.membershipStatus || 'none';
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended';

  const pauseHistory = membership?.pauseHistory || [];
  const hasPausedThisYear = pauseHistory.some((entry) => {
    if (!entry.requestedAt) return false;
    return new Date(entry.requestedAt).getFullYear() === CURRENT_YEAR;
  });

  const canPauseMembership = isActive && !hasPausedThisYear;

  const totalClasses = membership?.plan?.classLimit ?? null;
  const classesUsed = membership?.classesUsed || 0;
  const classesRemaining = membership?.classesRemaining ?? (totalClasses !== null ? Math.max(0, totalClasses - classesUsed) : 'Unlimited');
  const usagePercent = totalClasses ? Math.min(100, Math.round((classesUsed / totalClasses) * 100)) : 100;

  return (
    <div className="member-dashboard-wrap zen-dashboard-wrapper">
      {/* Toast Notification */}
      {copyToast && (
        <div className="dashboard-toast fade-in">
          <span>✦ Cryptographic Pass Code Copied to Clipboard</span>
        </div>
      )}

      {/* =========================================================================
          1. ELEGANT PERSONALIZED WELCOME BANNER
          ========================================================================= */}
      <section className="dashboard-banner zen-welcome-banner">
        <div className="banner-left">
          <div className="member-avatar-lg zen-avatar">
            <span>{(profile?.name || currentUser?.name || 'M').slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="banner-text">
            <div className="banner-eyebrow zen-eyebrow">
              <span className="crest-sparkle">✦</span>
              <span>ZEN LUXE YOGA SANCTUARY</span>
            </div>
            <h1 className="banner-heading">
              Welcome back, {profile?.name || currentUser?.name || 'Practitioner'}
            </h1>
            <p className="zen-wellness-subhead">
              Cultivate your daily balance, mindful breath, and strength in our serene sanctuary.
            </p>
            <div className="zen-member-meta-pill">
              <span>{profile?.email || currentUser?.email}</span>
              <span className="meta-separator">•</span>
              <span>Member ID: {profile?.id ? String(profile.id).slice(-8) : 'VERIFIED'}</span>
              <span className="meta-separator">•</span>
              <span className={`status-badge-inline status-${status}`}>
                {status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="banner-actions zen-banner-actions">
          {onNavigateAI && (
            <button
              className="btn-outline btn-sm zen-ai-btn"
              onClick={onNavigateAI}
              title="Open AI Wellness Assistant"
            >
              <i className="fa-solid fa-leaf" style={{ color: 'var(--sage)' }}></i>
              <span>AI Assistant</span>
            </button>
          )}
          <button
            className="btn-outline btn-sm"
            onClick={loadDashboardData}
            title="Refresh telemetry"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>Refresh</span>
          </button>
          <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
            <span>Upgrade / Renew</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          2. DASHBOARD NAVIGATION (7 ESSENTIAL WELLNESS SECTIONS)
          ========================================================================= */}
      <nav className="zen-dashboard-nav" role="tablist" aria-label="Dashboard Sections">
        <button
          className={`zen-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabClick('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
        >
          <i className="fa-solid fa-compass"></i>
          <span>Dashboard</span>
        </button>

        <button
          className={`zen-nav-tab ${activeTab === 'membership' ? 'active' : ''}`}
          onClick={() => handleTabClick('membership')}
          role="tab"
          aria-selected={activeTab === 'membership'}
        >
          <i className="fa-solid fa-layer-group"></i>
          <span>Membership</span>
        </button>

        <button
          className={`zen-nav-tab ${activeTab === 'pass' || activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => handleTabClick('pass')}
          role="tab"
          aria-selected={activeTab === 'pass' || activeTab === 'qr'}
        >
          <i className="fa-solid fa-qrcode"></i>
          <span>My Pass / QR</span>
        </button>

        <button
          className={`zen-nav-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => handleTabClick('payments')}
          role="tab"
          aria-selected={activeTab === 'payments'}
        >
          <i className="fa-solid fa-receipt"></i>
          <span>Payments</span>
        </button>

        <button
          className={`zen-nav-tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => handleTabClick('attendance')}
          role="tab"
          aria-selected={activeTab === 'attendance'}
        >
          <i className="fa-solid fa-calendar-check"></i>
          <span>Attendance</span>
        </button>

        <button
          className="zen-nav-tab zen-ai-tab"
          onClick={() => handleTabClick('ai')}
          role="tab"
          title="Open Conversational AI Assistant"
        >
          <i className="fa-solid fa-leaf"></i>
          <span>AI Assistant</span>
        </button>

        <button
          className={`zen-nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleTabClick('profile')}
          role="tab"
          aria-selected={activeTab === 'profile'}
        >
          <i className="fa-regular fa-user"></i>
          <span>Profile</span>
        </button>
      </nav>

      {/* Error / Alert Display */}
      {error && (
        <div className="dashboard-alert alert-danger fade-in">
          <span className="alert-symbol">⚠</span>
          <div>
            <strong>Sanctuary Notice</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="dashboard-alert alert-warning fade-in">
          <span className="alert-symbol">◷</span>
          <div>
            <strong>Membership Currently On Hold</strong>
            <p>
              Your pass verification is paused. Your studio access will automatically resume on{' '}
              <strong>{formatDate(membership?.pauseEndDate)}</strong>.
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
              Your membership period has concluded. Renew your tier to reactivate your digital pass and continue practicing.
            </p>
          </div>
          <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
            Renew Plan Now
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: DASHBOARD OVERVIEW (Primary Wellness View)
          ========================================================================= */}
      {(activeTab === 'overview' || activeTab === 'all') && (
        <div className="zen-tab-panel fade-in">
          {/* Main Hero Overview Card */}
          <div className="zen-overview-card">
            <div className="overview-card-header">
              <div>
                <span className="zen-kicker">SANCTUARY PRIVILEGE STANDING</span>
                <h2 className="overview-card-title">
                  {membership?.plan?.name ? `${membership.plan.name} Tier` : 'Sanctuary Member'}
                </h2>
              </div>
              <div className="overview-card-badge-wrap">
                <span className={`status-indicator-badge badge-${status}`}>
                  <span className="status-dot"></span>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="overview-card-body">
              <div className="overview-metrics-triad">
                <div className="overview-metric-item">
                  <span className="item-label">VALIDITY WINDOW</span>
                  <strong className="item-value">
                    {membership?.endDate ? formatDate(membership.endDate) : 'Select a Plan'}
                  </strong>
                  <span className="item-sub">
                    {isActive ? 'Active & Verified' : isPaused ? 'Paused' : 'No active cycle'}
                  </span>
                </div>

                <div className="overview-metric-item">
                  <span className="item-label">CLASS UTILIZATION</span>
                  <strong className="item-value">
                    {classesUsed} <span className="item-val-sub">/ {totalClasses !== null ? `${totalClasses} Classes` : 'Unlimited'}</span>
                  </strong>
                  <div className="zen-progress-bar-wrap">
                    <div className="zen-progress-bar" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <span className="item-sub">{classesRemaining} sessions remaining</span>
                </div>

                <div className="overview-metric-item">
                  <span className="item-label">CRYPTOGRAPHIC PASS KEY</span>
                  <div className="pass-code-pill-interactive" onClick={handleCopyPassCode} title="Click to copy pass key">
                    <code>
                      {profile?.passCode
                        ? `${profile.passCode.slice(0, 10)}••••${profile.passCode.slice(-4)}`
                        : 'GENERATING...'}
                    </code>
                    <i className="fa-regular fa-copy"></i>
                  </div>
                  <span className="item-sub">256-bit optical check-in key</span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="zen-quick-actions-bar">
                <button className="btn-primary btn-sm" onClick={onOpenQRModal}>
                  <i className="fa-solid fa-qrcode"></i>
                  <span>Present QR Pass</span>
                </button>
                <button className="btn-outline btn-sm" onClick={() => handleTabClick('membership')}>
                  <i className="fa-solid fa-layer-group"></i>
                  <span>Manage Membership</span>
                </button>
                <button className="btn-outline btn-sm" onClick={() => handleTabClick('payments')}>
                  <i className="fa-solid fa-receipt"></i>
                  <span>Payment Ledger</span>
                </button>
                <button className="btn-outline btn-sm" onClick={onNavigateAI}>
                  <i className="fa-solid fa-leaf" style={{ color: 'var(--sage)' }}></i>
                  <span>Ask AI Assistant</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="dashboard-metrics-grid zen-metrics-grid">
            <div className="metric-box zen-metric-card" onClick={() => handleTabClick('attendance')}>
              <div className="zen-card-icon-top">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
              <span className="metric-kicker">TOTAL SESSIONS ATTENDED</span>
              <h3 className="metric-value">{attendanceHistory.length}</h3>
              <p className="metric-note">Verified studio check-ins recorded</p>
            </div>

            <div className="metric-box zen-metric-card" onClick={() => handleTabClick('membership')}>
              <div className="zen-card-icon-top">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <span className="metric-kicker">SESSIONS REMAINING</span>
              <h3 className="metric-value">{classesRemaining}</h3>
              <p className="metric-note">Available for immediate booking</p>
            </div>

            <div className="metric-box zen-metric-card" onClick={() => handleTabClick('pass')}>
              <div className="zen-card-icon-top">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <span className="metric-kicker">PASS SECURITY STANDING</span>
              <h3 className="metric-value">{isActive ? 'Verified' : 'Inactive'}</h3>
              <p className="metric-note">Optical turnstile admission active</p>
            </div>

            <div className="metric-box zen-metric-card zen-ai-promo-card" onClick={onNavigateAI}>
              <div className="zen-card-icon-top">
                <i className="fa-solid fa-sparkles"></i>
              </div>
              <span className="metric-kicker">AI WELLNESS CO-PILOT</span>
              <h3 className="metric-value">Active</h3>
              <p className="metric-note">Consult for posture &amp; renewals →</p>
            </div>
          </div>

          {/* Side by Side Preview: Pass & Recent Attendance */}
          <div className="dashboard-content-split zen-split-layout">
            {/* Left: Pass Preview */}
            <div className="pass-preview-column">
              <div className="section-sub-header">
                <h3>Digital Membership Pass</h3>
                <p>Present this contactless optical card at the studio reception or turnstile scanner.</p>
              </div>

              <div className="card-stage dashboard-card-stage">
                <div className={`digital-pass-card zen-pass-card ${isPaused ? 'card-paused' : ''} ${isEnded ? 'card-ended' : ''}`}>
                  <div className="card-watermark" aria-hidden="true"></div>

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

                  <div className="pass-tier-ribbon">
                    <span className="ribbon-sparkle">✦</span>
                    <span className="ribbon-text">
                      {membership?.plan?.name ? `${membership.plan.name.toUpperCase()} SANCTUARY PASS` : 'PRACTITIONER PASS'}
                    </span>
                  </div>

                  <div className="pass-member-profile">
                    <div className="pass-avatar">
                      <span>{(profile?.name || currentUser?.name || 'M').slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="member-meta">
                      <h3 className="member-name">{profile?.name || currentUser?.name || 'Practitioner'}</h3>
                      <p className="member-role">Verified Yoga Member</p>
                      <code className="pass-code">CODE: {profile?.passCode ? `${profile.passCode.slice(0, 14)}...` : 'PENDING'}</code>
                    </div>
                  </div>

                  <div className="card-ornament-divider">
                    <div className="divider-line"></div>
                    <span className="divider-diamond">✦</span>
                    <div className="divider-line"></div>
                  </div>

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
                          <span>Instant Studio Check-In</span>
                        </div>
                      </div>
                    ) : (
                      <div className="qr-disabled-placeholder">
                        <span className="qr-disabled-icon">{isPaused ? '◷' : '✕'}</span>
                        <p>{isPaused ? 'Pass Paused • Turnstile Inactive' : isEnded ? 'Pass Expired • Renew Plan' : 'No Active Membership'}</p>
                      </div>
                    )}
                  </div>

                  <div className="pass-card-bottom">
                    <div className="bottom-col">
                      <span className="label">EXPIRY DATE</span>
                      <span className="value">{membership?.endDate ? formatDate(membership.endDate) : 'N/A'}</span>
                    </div>
                    <div className="bottom-col text-right">
                      <span className="label">CLASSES USED</span>
                      <span className="value">{classesUsed} {totalClasses ? `/ ${totalClasses}` : 'Used'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pass-actions-row">
                {isActive && passData?.pass?.qrCode && (
                  <button className="btn-primary btn-sm" onClick={handleDownloadQR}>
                    <i className="fa-solid fa-download"></i>
                    <span>Download PNG</span>
                  </button>
                )}
                <button className="btn-outline btn-sm" onClick={onOpenQRModal}>
                  <i className="fa-solid fa-expand"></i>
                  <span>Full-Screen QR</span>
                </button>
              </div>
            </div>

            {/* Right: Recent Attendance Stream */}
            <div className="dashboard-records-column">
              <div className="section-sub-header section-header-split">
                <div>
                  <h3>Recent Attendance Activity</h3>
                  <p>Latest class check-in entries validated by studio instructors.</p>
                </div>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => handleTabClick('attendance')}
                >
                  <span>View All →</span>
                </button>
              </div>

              <div className="payment-history-card zen-card-clean">
                {attendanceHistory.length === 0 ? (
                  <div className="no-payments-placeholder">
                    <span className="placeholder-icon">✦</span>
                    <p>No class check-in records located yet.</p>
                  </div>
                ) : (
                  <div className="zen-attendance-stream">
                    {attendanceHistory.slice(0, 4).map((record) => (
                      <div className="zen-stream-item" key={record.id}>
                        <div className="stream-badge-check">
                          <i className="fa-solid fa-check"></i>
                        </div>
                        <div className="stream-details">
                          <strong>{record.planName || 'Yoga Session'}</strong>
                          <p>Verified by {record.staffName || 'Studio Instructor'}</p>
                        </div>
                        <div className="stream-time-badge">
                          <span>{formatDate(record.checkedInAt)}</span>
                          <span className="sub-time">{formatTime(record.checkedInAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Entry Box in Overview */}
              <div className="zen-ai-promo-banner" onClick={onNavigateAI}>
                <div className="promo-leaf-icon">
                  <i className="fa-solid fa-leaf"></i>
                </div>
                <div className="promo-text">
                  <h4>Intelligent Wellness Assistant</h4>
                  <p>Inquire about class timings, renewal forecasts, breathing exercises, and membership policies.</p>
                </div>
                <span className="promo-arrow">→</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MEMBERSHIP MANAGEMENT & PAUSE
          ========================================================================= */}
      {activeTab === 'membership' && (
        <div className="zen-tab-panel fade-in">
          <div className="section-sub-header">
            <h3>Membership &amp; Validity Management</h3>
            <p>Review your active plan details, session entitlements, validity schedule, and annual pause privilege.</p>
          </div>

          <div className="zen-membership-detail-grid">
            <div className="zen-card-clean zen-plan-summary-card">
              <span className="zen-kicker">CURRENT SUBSCRIPTION</span>
              <h2 className="zen-card-headline">{membership?.plan?.name || 'Standard Tier'} Sanctuary Membership</h2>
              <div className="zen-plan-meta-row">
                <span className={`status-indicator-badge badge-${status}`}>
                  <span className="status-dot"></span>
                  {status.toUpperCase()}
                </span>
                <span className="meta-text">Valid through {formatDate(membership?.endDate)}</span>
              </div>

              <div className="zen-spec-table">
                <div className="spec-item">
                  <span className="spec-kicker">SESSION ALLOWANCE</span>
                  <span className="spec-val">{totalClasses !== null ? `${totalClasses} Classes` : 'Unlimited Sessions'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-kicker">SESSIONS COMPLETED</span>
                  <span className="spec-val">{classesUsed} Check-ins</span>
                </div>
                <div className="spec-item">
                  <span className="spec-kicker">SESSIONS REMAINING</span>
                  <span className="spec-val">{classesRemaining} Available</span>
                </div>
                <div className="spec-item">
                  <span className="spec-kicker">PLAN CYCLE</span>
                  <span className="spec-val">{membership?.plan?.durationDays ? `${membership.plan.durationDays} Days` : '30 Days'}</span>
                </div>
              </div>

              <div className="zen-card-actions">
                <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
                  <span>Upgrade or Renew Plan</span>
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </div>

            {/* Membership Pause Feature */}
            <div className="zen-card-clean zen-pause-card">
              <span className="zen-kicker">ANNUAL PAUSE BENEFIT</span>
              <h3 className="zen-card-headline">Membership Freeze Request</h3>
              <p className="zen-card-desc">
                Take a mindful break from practice. You may freeze your active membership once per calendar year for 1 to 15 days. Your validity date will be automatically extended.
              </p>

              {pauseMessage && (
                <div className="dashboard-alert alert-success fade-in">
                  <span className="alert-symbol">✓</span>
                  <p>{pauseMessage}</p>
                </div>
              )}

              {pauseError && (
                <div className="dashboard-alert alert-danger fade-in">
                  <span className="alert-symbol">⚠</span>
                  <p>{pauseError}</p>
                </div>
              )}

              {isPaused ? (
                <div className="zen-pause-active-box">
                  <strong>Your membership is currently frozen.</strong>
                  <p>Scheduled resumption: <strong>{formatDate(membership?.pauseEndDate)}</strong></p>
                  <p>Extended validity through: <strong>{formatDate(membership?.endDate)}</strong></p>
                </div>
              ) : hasPausedThisYear ? (
                <div className="zen-pause-used-box">
                  <i className="fa-solid fa-circle-info"></i>
                  <p>Your annual pause allowance has already been exercised for this calendar year. It will refresh on January 1st.</p>
                </div>
              ) : canPauseMembership ? (
                <form onSubmit={handlePauseMembership} className="zen-pause-form">
                  <label htmlFor="pause-duration-select" className="zen-input-label">
                    Select Pause Duration (Days):
                  </label>
                  <div className="zen-pause-input-group">
                    <select
                      id="pause-duration-select"
                      value={pauseDays}
                      onChange={(e) => setPauseDays(e.target.value)}
                      disabled={pauseLoading}
                      className="zen-select-input"
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day} {day === 1 ? 'Day Pause' : 'Days Pause'} (+{day} Days Validity)
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      className="btn-outline btn-sm zen-pause-submit-btn"
                      disabled={pauseLoading}
                    >
                      {pauseLoading ? 'Submitting...' : 'Freeze Membership'}
                    </button>
                  </div>
                  <span className="zen-hint-text">
                    Studio access will be suspended during the freeze period.
                  </span>
                </form>
              ) : (
                <p className="zen-hint-text">
                  Membership pause is available only when your membership is in active standing.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MY PASS / QR
          ========================================================================= */}
      {(activeTab === 'pass' || activeTab === 'qr') && (
        <div className="zen-tab-panel fade-in">
          <div className="section-sub-header">
            <h3>Digital Membership Pass &amp; QR Terminal</h3>
            <p>Your official sanctuary pass. Hold your device before the optical scanner at the studio front desk for admission.</p>
          </div>

          <div className="zen-pass-stage-centered">
            <div className={`digital-pass-card zen-pass-card zen-pass-lg ${isPaused ? 'card-paused' : ''} ${isEnded ? 'card-ended' : ''}`}>
              <div className="card-watermark" aria-hidden="true"></div>

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

              <div className="pass-tier-ribbon">
                <span className="ribbon-sparkle">✦</span>
                <span className="ribbon-text">
                  {membership?.plan?.name ? `${membership.plan.name.toUpperCase()} SANCTUARY PASS` : 'PRACTITIONER PASS'}
                </span>
              </div>

              <div className="pass-member-profile">
                <div className="pass-avatar">
                  <span>{(profile?.name || currentUser?.name || 'M').slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="member-meta">
                  <h3 className="member-name">{profile?.name || currentUser?.name || 'Practitioner'}</h3>
                  <p className="member-role">Verified Yoga Member</p>
                  <code className="pass-code">CODE: {profile?.passCode ? `${profile.passCode.slice(0, 16)}...` : 'PENDING'}</code>
                </div>
              </div>

              <div className="card-ornament-divider">
                <div className="divider-line"></div>
                <span className="divider-diamond">✦</span>
                <div className="divider-line"></div>
              </div>

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
                    <span className="qr-disabled-icon">{isPaused ? '◷' : '✕'}</span>
                    <p>{isPaused ? 'Pass Paused • Studio Check-In Disabled' : isEnded ? 'Pass Expired • Please Renew Plan' : 'No Active Membership'}</p>
                  </div>
                )}
              </div>

              <div className="pass-card-bottom">
                <div className="bottom-col">
                  <span className="label">EXPIRY DATE</span>
                  <span className="value">{membership?.endDate ? formatDate(membership.endDate) : 'N/A'}</span>
                </div>
                <div className="bottom-col text-right">
                  <span className="label">CLASSES USED</span>
                  <span className="value">{classesUsed} {totalClasses ? `/ ${totalClasses}` : 'Used'}</span>
                </div>
              </div>
            </div>

            <div className="zen-pass-button-row">
              {isActive && passData?.pass?.qrCode && (
                <button className="btn-primary btn-sm" onClick={handleDownloadQR}>
                  <i className="fa-solid fa-download"></i>
                  <span>Download Pass Image (PNG)</span>
                </button>
              )}
              <button className="btn-outline btn-sm" onClick={onOpenQRModal}>
                <i className="fa-solid fa-expand"></i>
                <span>Open Full-Screen Scanner View</span>
              </button>
              <button className="btn-outline btn-sm" onClick={handleCopyPassCode}>
                <i className="fa-regular fa-copy"></i>
                <span>Copy Pass Key</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: PAYMENTS LEDGER
          ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="zen-tab-panel fade-in">
          <div className="section-sub-header section-header-split">
            <div>
              <h3>Verified Privilege Transactions</h3>
              <p>Comprehensive ledger of membership subscriptions, renewals, and payments.</p>
            </div>
            <button className="btn-primary btn-sm" onClick={onNavigateToPlans}>
              <span>New Membership</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>

          <div className="payment-history-card zen-card-clean">
            {profile?.recentPayments && profile.recentPayments.length > 0 ? (
              <div className="payments-table-wrap">
                <table className="payments-table zen-table">
                  <thead>
                    <tr>
                      <th>Plan Tier</th>
                      <th>Order Reference</th>
                      <th>Transaction Date</th>
                      <th>Amount Paid</th>
                      <th>Payment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.recentPayments.map((p) => (
                      <tr key={p.id || p.orderId}>
                        <td>
                          <strong>{p.planName}</strong>
                        </td>
                        <td>
                          <code className="order-ref">
                            {p.orderId?.slice(-10) || (p.id ? String(p.id).slice(-8) : 'N/A')}
                          </code>
                        </td>
                        <td>
                          {new Date(p.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="amount-col">
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className={`payment-status-badge ${p.status}`}>
                            {p.status ? p.status.toUpperCase() : 'VERIFIED'}
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
                  Explore Sanctuary Plans
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: ATTENDANCE HISTORY
          ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="zen-tab-panel fade-in">
          <div className="section-sub-header section-header-split">
            <div>
              <h3>Class Attendance History</h3>
              <p>Verified timestamps of your yoga studio check-ins authenticated by studio reception.</p>
            </div>
            <button
              className="btn-outline btn-sm"
              onClick={loadAttendanceHistory}
              disabled={attendanceLoading}
              title="Refresh attendance records"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
              <span>{attendanceLoading ? 'Refreshing...' : 'Refresh Records'}</span>
            </button>
          </div>

          {attendanceError && (
            <div className="dashboard-alert alert-danger fade-in">
              <span className="alert-symbol">⚠</span>
              <p>{attendanceError}</p>
            </div>
          )}

          <div className="payment-history-card zen-card-clean">
            {attendanceLoading && attendanceHistory.length === 0 ? (
              <div className="no-payments-placeholder">
                <div className="crest-spinner"></div>
                <p>Retrieving your verified attendance history...</p>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <div className="no-payments-placeholder">
                <span className="placeholder-icon">✦</span>
                <p>No class check-in records recorded yet. Present your pass at the studio front desk.</p>
              </div>
            ) : (
              <div className="payments-table-wrap">
                <table className="payments-table zen-table">
                  <thead>
                    <tr>
                      <th>Yoga Program</th>
                      <th>Staff Instructor</th>
                      <th>Check-in Date</th>
                      <th>Check-in Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.planName}</strong>
                        </td>
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
                        <td>
                          <span className="payment-status-badge captured">
                            AUTHENTICATED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: PRACTITIONER PROFILE & SETTINGS
          ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="zen-tab-panel fade-in">
          <div className="section-sub-header">
            <h3>Practitioner Profile &amp; Account Settings</h3>
            <p>Review your personal membership profile, digital credentials, and account details.</p>
          </div>

          <div className="zen-profile-grid">
            <div className="zen-card-clean zen-profile-card">
              <div className="profile-card-top">
                <div className="profile-avatar-xl zen-avatar">
                  <span>{(profile?.name || currentUser?.name || 'M').slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="profile-name">{profile?.name || currentUser?.name || 'Practitioner'}</h2>
                  <span className="profile-role">Verified Yoga Member</span>
                </div>
              </div>

              <div className="profile-details-list">
                <div className="profile-detail-row">
                  <span className="row-label">EMAIL ADDRESS</span>
                  <strong className="row-value">{profile?.email || currentUser?.email || 'N/A'}</strong>
                </div>

                <div className="profile-detail-row">
                  <span className="row-label">PHONE NUMBER</span>
                  <strong className="row-value">{profile?.phone || currentUser?.phone || 'Not Provided'}</strong>
                </div>

                <div className="profile-detail-row">
                  <span className="row-label">MEMBERPASS IDENTIFIER</span>
                  <strong className="row-value">{profile?.id ? String(profile.id) : 'MP-MEMBER'}</strong>
                </div>

                <div className="profile-detail-row">
                  <span className="row-label">CRYPTOGRAPHIC PASS KEY</span>
                  <div className="pass-key-copy-row" onClick={handleCopyPassCode} title="Click to copy">
                    <code>{profile?.passCode || currentUser?.passCode || 'N/A'}</code>
                    <i className="fa-regular fa-copy"></i>
                  </div>
                </div>

                <div className="profile-detail-row">
                  <span className="row-label">MEMBERSHIP STANDING</span>
                  <span className={`status-indicator-badge badge-${status}`}>
                    <span className="status-dot"></span>
                    {status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="profile-actions-bottom">
                <button className="btn-outline btn-sm" onClick={handleCopyPassCode}>
                  <i className="fa-regular fa-copy"></i>
                  <span>Copy Pass Key</span>
                </button>
                {onLogout && (
                  <button className="btn-outline btn-sm zen-logout-btn" onClick={onLogout}>
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
