import { useState, useEffect } from 'react'
import './App.css'
import AuthModal from './components/AuthModal'
import PlansSection from './components/PlansSection'
import MemberDashboard from './components/MemberDashboard'
import QRPassModal from './components/QRPassModal'
import StaffDashboard from './components/StaffDashboard'
import { getStoredUser, authApi } from './services/api'

export default function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser())
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState('login')
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState('landing') // 'landing' | 'dashboard'

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState('tiers')
  const [selectedPlanToast, setSelectedPlanToast] = useState(null)
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState(
    '“38 esteemed members are scheduled for renewal this week. Automated reminders have been dispatched with an anticipated 98.4% retention rate.”'
  )

  const handleLogout = async () => {
    await authApi.logout()
    setCurrentUser(null)
    setCurrentView('landing')
    setSelectedPlanToast('You have securely signed out of MemberPass.')
  }

  const handleAuthSuccess = (user) => {
    setCurrentUser(user)
    setCurrentView('dashboard')
    setSelectedPlanToast(`Welcome back, ${user.name}! Access credentials authenticated.`)
  }

  const handlePaymentSuccess = (data) => {
    setCurrentView('dashboard')
    setSelectedPlanToast(`Payment successful! Your ${data.plan} membership is now active.`)
  }

  // Handle header blur on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-dismiss plan selection toast after 4s
  useEffect(() => {
    if (selectedPlanToast) {
      const timer = setTimeout(() => setSelectedPlanToast(null), 4200)
      return () => clearTimeout(timer)
    }
  }, [selectedPlanToast])

  const handleAiAsk = async (question) => {
    if (!question.trim() || aiLoading) return

    setAiLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'AI request failed')
      }

      setAiResponse(data.answer)
      setAiQuery('')
    } catch (error) {
      console.error('MemberPass AI error:', error)
      setAiResponse('Unable to connect to MemberPass AI. Please check the backend and AI service.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiSimulate = (key) => {
    const prompts = {
      renewals: 'How can I check membership renewals?',
      attendance: 'How can I view attendance history?',
      tiers: 'What membership plans are available?',
      passes: 'How does the digital QR pass work?'
    }

    if (prompts[key]) handleAiAsk(prompts[key])
  }

  const handleCustomAiSubmit = (e) => {
    e.preventDefault()
    handleAiAsk(aiQuery)
  }
  const _handlePlanSelect = (planName) => {
    setSelectedPlanToast(`You have selected the ${planName}. Our yoga centre wellness coordinator will connect with you shortly.`)
  }

  const handleContactSubmit = (e) => {
    e.preventDefault()
    setContactSubmitted(true)
    setTimeout(() => setContactSubmitted(false), 5000)
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="royale-app">
      {/* Toast Notification */}
      {selectedPlanToast && (
        <div className="toast-notification" role="status" aria-live="polite">
          <div className="toast-icon">✦</div>
          <div className="toast-body">
            <strong>Yoga Membership Initiated</strong>
            <p>{selectedPlanToast}</p>
          </div>
          <button className="toast-close" onClick={() => setSelectedPlanToast(null)} aria-label="Close notification">×</button>
        </div>
      )}

      {/* =========================================================================
          1. ELEGANT NAVBAR
          ========================================================================= */}
      <header className={`royale-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <a
            href="#home"
            className="brand-logo"
            aria-label="MemberPass Home"
            onClick={(e) => {
              e.preventDefault()
              setCurrentView('landing')
            }}
          >
            <span className="crest-mark">
              <span className="crest-monogram">M</span>
              <span className="crest-sparkle">✦</span>
            </span>
            <div className="brand-text">
              <span className="brand-name">Member<span className="highlight-rose">Pass</span></span>
            </div>
          </a>

          <nav className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                setCurrentView('landing')
                setMobileMenuOpen(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Home
            </a>
            <a
              href="#features"
              onClick={() => {
                if (currentView !== 'landing') setCurrentView('landing')
                setMobileMenuOpen(false)
              }}
            >
              Features
            </a>
            <a
              href="#plans"
              onClick={() => {
                if (currentView !== 'landing') setCurrentView('landing')
                setMobileMenuOpen(false)
              }}
            >
              Membership Plans
            </a>
            <a
              href="#about"
              onClick={() => {
                if (currentView !== 'landing') setCurrentView('landing')
                setMobileMenuOpen(false)
              }}
            >
              About
            </a>

            {currentUser ? (
              <>
                <button
                  className="nav-link-btn"
                  onClick={() => {
                    setCurrentView('dashboard')
                    setMobileMenuOpen(false)
                  }}
                >
                  {['staff', 'admin'].includes(currentUser.role) ? 'Staff Portal' : 'Dashboard'}
                </button>
                {!['staff', 'admin'].includes(currentUser.role) && (
                  <button
                    className="nav-link-btn"
                    onClick={() => {
                      setQrModalOpen(true)
                      setMobileMenuOpen(false)
                    }}
                  >
                    My QR Pass
                  </button>
                )}
              </>
            ) : null}

            <div className="mobile-cta-wrap">
              {currentUser ? (
                <button className="btn-primary btn-sm" onClick={handleLogout}>
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => {
                    setAuthModalMode('signup')
                    setAuthModalOpen(true)
                    setMobileMenuOpen(false)
                  }}
                >
                  <span>Claim Your Pass</span>
                  <span className="btn-arrow">→</span>
                </button>
              )}
            </div>
          </nav>

          <div className="nav-actions">
            {currentUser ? (
              <div className="nav-auth-group">
                <button
                  className="nav-user-pill"
                  onClick={() => setCurrentView('dashboard')}
                  title={['staff', 'admin'].includes(currentUser.role) ? 'Open Staff Portal' : 'Open Member Dashboard'}
                >
                  <div className="nav-avatar-mini">
                    {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'MP'}
                  </div>
                  <span className="nav-user-name">
                    {currentUser.name ? currentUser.name.split(' ')[0] : 'Member'}
                    {['staff', 'admin'].includes(currentUser.role) ? ' (Staff)' : ''}
                  </span>
                </button>
                <button className="btn-signout" onClick={handleLogout} title="Sign Out">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="nav-auth-group">
                <button
                  className="btn-outline btn-sm"
                  onClick={() => {
                    setAuthModalMode('login')
                    setAuthModalOpen(true)
                  }}
                >
                  Sign In
                </button>
                <button
                  className="btn-primary desktop-cta"
                  onClick={() => {
                    setAuthModalMode('signup')
                    setAuthModalOpen(true)
                  }}
                >
                  <span>Claim Your Pass</span>
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            )}

            <button
              className={`hamburger-toggle ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {currentView === 'dashboard' && currentUser ? (
        <main>
          {['staff', 'admin'].includes(currentUser.role) ? (
            <StaffDashboard
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          ) : (
            <MemberDashboard
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigateToPlans={() => {
                setCurrentView('landing')
                setTimeout(() => {
                  const el = document.getElementById('plans')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }, 120)
              }}
              onOpenQRModal={() => setQrModalOpen(true)}
            />
          )}
        </main>
      ) : (
        <main>
          {/* =========================================================================
            2. HERO SECTION
            ========================================================================= */}
          <section className="hero-section" id="home">
            <div className="hero-grid">
              <div className="hero-text-content">
                <div className="luxury-eyebrow">
                  <span className="crest-sparkle">✦</span>
                  <span>SMART YOGA &amp; WELLNESS PLATFORM</span>
                </div>

                <h1 className="hero-headline">
                  Your Wellness Journey,
                  <br />
                  <span className="serif-italic-accent">Elevated to Excellence.</span>
                </h1>

                <p className="hero-subhead">
                  Smart Yoga Membership Management Powered by AI
                </p>

                <p className="hero-description">
                  Experience seamless yoga memberships, class participation tracking, secure digital passes and intelligent wellness management through MemberPass.
                </p>

                <div className="hero-ctas">
                  <a href="#plans" className="btn-primary btn-lg">
                    <span>Get Started</span>
                    <span className="btn-arrow">→</span>
                  </a>
                  <a href="#plans" className="btn-outline btn-lg">
                    <span>Explore Plans</span>
                    <span className="btn-chevron">▾</span>
                  </a>
                </div>

                <div className="hero-trust-bar">
                  <div className="trust-pill">
                    <span className="pill-check">✓</span>
                    <span>99.8% Verification Accuracy</span>
                  </div>
                  <div className="trust-divider"></div>
                  <div className="trust-pill">
                    <span className="pill-check">✓</span>
                    <span>Instant QR Pass Check-In</span>
                  </div>
                  <div className="trust-divider"></div>
                  <div className="trust-pill">
                    <span className="pill-check">✓</span>
                    <span>Smart Class &amp; Attendance Tracking</span>
                  </div>
                </div>
              </div>

              {/* DIGITAL MEMBERSHIP CARD MOCKUP */}
              <div className="hero-card-col">
                <div className="card-stage">
                  <div className="digital-pass-card">
                    {/* Subtle Guilloché Watermark */}
                    <div className="card-watermark" aria-hidden="true"></div>

                    {/* Card Top Row */}
                    <div className="pass-card-top">
                      <div className="pass-crest">
                        <span className="crest-symbol">M</span>
                        <div className="crest-details">
                          <span className="crest-title">MEMBERPASS</span>
                          <span className="crest-sub">YOGA &amp; WELLNESS SANCTUARY</span>
                        </div>
                      </div>
                      <div className="pass-status-pill">
                        <span className="pulsing-emerald"></span>
                        <span>ACTIVE • VERIFIED</span>
                      </div>
                    </div>

                    {/* Pass Category Chip */}
                    <div className="pass-tier-ribbon">
                      <span className="ribbon-sparkle">✦</span>
                      <span className="ribbon-text">STANDARD YOGA PASS</span>
                    </div>

                    {/* Member Profile Row */}
                    <div className="pass-member-profile">
                      <div className="pass-avatar">
                        <span>ML</span>
                      </div>
                      <div className="member-meta">
                        <h3 className="member-name">Maya Lin</h3>
                        <p className="member-role">Practitioner Member</p>
                        <code className="pass-code">ID: YOGA-2026-8894X</code>
                      </div>
                    </div>

                    {/* Divider with Central Rose Diamond */}
                    <div className="card-ornament-divider">
                      <div className="divider-line"></div>
                      <span className="divider-diamond">✦</span>
                      <div className="divider-line"></div>
                    </div>

                    {/* Card Footer Details & QR Code */}
                    <div className="pass-card-bottom">
                      <div className="pass-metadata-grid">
                        <div className="meta-block">
                          <span className="meta-label">MEMBERSHIP PLAN</span>
                          <strong className="meta-value">Standard Plan</strong>
                        </div>
                        <div className="meta-block">
                          <span className="meta-label">CLASSES INCLUDED</span>
                          <strong className="meta-value">25 SESSIONS</strong>
                        </div>
                        <div className="meta-block">
                          <span className="meta-label">VALIDITY</span>
                          <strong className="meta-value font-mono">30 DAYS</strong>
                        </div>
                      </div>

                      <div className="pass-qr-container">
                        <div className="qr-frame">
                          <svg viewBox="0 0 80 80" className="qr-svg" role="img" aria-label="Digital pass verification QR code">
                            <rect width="80" height="80" rx="6" fill="#F7F2E9" />
                            <g fill="#242424">
                              {/* Position Detection Squares */}
                              <path d="M7 7h22v22H7zm4 4v14h14V11zM51 7h22v22H51zm4 4v14h14V11zM7 51h22v22H7zm4 4v14h14V55z" />
                              {/* Inner Center Points in Champagne Gold */}
                              <rect x="14" y="14" width="8" height="8" rx="1" fill="#C6A66B" />
                              <rect x="58" y="14" width="8" height="8" rx="1" fill="#C6A66B" />
                              <rect x="14" y="58" width="8" height="8" rx="1" fill="#C6A66B" />
                              {/* Data Pattern */}
                              <path d="M36 7h8v5h-8zm0 10h8v8h-8zm0 16h6v6h-6zm8 4h8v6h-8zm-14 8h6v6h-6zm14 0h6v6h-6zm12-14h8v6h-8zm0 10h8v8h-8zm-22 14h8v6h-8zm12 0h8v6h-8zm-12 10h8v6h-8zm16-4h6v10h-6zm8-6h6v12h-6z" />
                            </g>
                          </svg>
                          <div className="qr-micro-crest">✦</div>
                        </div>
                        <span className="qr-caption">SCAN PASS</span>
                      </div>
                    </div>

                    <div className="card-bottom-bar">
                      <span className="bar-tag">DIGITAL YOGA PASS IDENTIFICATION</span>
                      <span className="bar-brand">MEMBERPASS</span>
                    </div>
                  </div>

                  {/* Floating Micro-Widgets */}
                  <div className="floating-badge badge-top-right">
                    <div className="badge-icon icon-gold">✦</div>
                    <div className="badge-text">
                      <strong>AI Yoga Assistant</strong>
                      <p>Attendance &amp; session tracked</p>
                    </div>
                  </div>

                  <div className="floating-badge badge-bottom-left">
                    <div className="badge-icon icon-emerald">✓</div>
                    <div className="badge-text">
                      <strong>Digital Pass Verified</strong>
                      <p>Morning Vinyasa • Access Granted</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
            STATS SECTION
            ========================================================================= */}
          <section className="stats-strip">
            <div className="stats-inner">
              <div className="stat-card">
                <span className="stat-number">99.8%</span>
                <span className="stat-label">Membership Verification Accuracy</span>
                <p className="stat-detail">Seamless QR pass scanning and error-free attendance authentication</p>
              </div>
              <div className="stat-divider-vertical"></div>
              <div className="stat-card">
                <span className="stat-number">3.5×</span>
                <span className="stat-label">Faster Member Check-ins</span>
                <p className="stat-detail">Instant digital pass check-ins eliminating front-desk queues</p>
              </div>
              <div className="stat-divider-vertical"></div>
              <div className="stat-card">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Digital Membership Access</span>
                <p className="stat-detail">Always-on member portal for pass viewing, renewal, and session tracking</p>
              </div>
            </div>
          </section>

          {/* =========================================================================
            3. ABOUT SECTION
            ========================================================================= */}
          <section className="section-padding about-section" id="about">
            <div className="section-header text-center">
              <span className="section-kicker">ABOUT MEMBERPASS</span>
              <h2 className="section-heading">Where Wellness Meets Intelligent Membership</h2>
              <p className="section-subtext">
                Traditional studios are encumbered by paper sign-in sheets, fragmented rosters,
                and manual class counting. MemberPass creates an uncompromising, centralized ecosystem
                engineered specifically for modern yoga centres and wellness sanctuaries.
              </p>
            </div>

            <div className="about-grid">
              <div className="about-feature-box">
                <div className="box-icon">
                  <i className="fa-solid fa-gem"></i>
                </div>
                <h3 className="box-title">Premium Yoga Membership Experience</h3>
                <p className="box-desc">
                  Elevate your practitioner touchpoints from their very first class. Deliver high-resolution,
                  contactless digital QR passes that reflect the serene quality of your studio space.
                </p>
              </div>

              <div className="about-feature-box">
                <div className="box-icon">
                  <i className="fa-solid fa-brain"></i>
                </div>
                <h3 className="box-title">AI-Powered Wellness Assistance</h3>
                <p className="box-desc">
                  Our embedded machine learning model detects attendance trends early, triggers gracious
                  renewal invitations, and provides actionable class intelligence to studio managers.
                </p>
              </div>

              <div className="about-feature-box">
                <div className="box-icon">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <h3 className="box-title">Secure Digital Membership Management</h3>
                <p className="box-desc">
                  Member records, sensitive profile attributes, and class attendance logs are strictly protected
                  with secure digital verification and granular role-based administrative controls.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================================
            4. FEATURES SECTION
            ========================================================================= */}
          <section className="section-padding features-section" id="features">
            <div className="section-header text-center">
              <span className="section-kicker">CURATED CAPABILITIES</span>
              <h2 className="section-heading">Designed for Modern Yoga Centre Operations</h2>
              <p className="section-subtext">
                Every tool within MemberPass is crafted to reduce friction, eliminate paper sign-in sheets,
                and empower yoga studio directors with deep operational clarity.
              </p>
            </div>

            <div className="features-quad-grid">
              {/* Feature 1 */}
              <article className="feature-royal-card">
                <div className="card-header-icon">
                  <i className="fa-solid fa-sliders"></i>
                </div>
                <span className="card-sub-tag">TIER ALLOCATION</span>
                <h3 className="feature-card-title">Smart Membership Management</h3>
                <p className="feature-card-desc">
                  Effortlessly manage Basic, Standard, and Premium yoga membership plans with custom session caps,
                  validity windows, and automated renewal workflows.
                </p>
                <ul className="feature-checklist">
                  <li><span className="check-bullet">✦</span> Flexible Yoga Membership Plans</li>
                  <li><span className="check-bullet">✦</span> Automated Validity &amp; Expiry Triggers</li>
                  <li><span className="check-bullet">✦</span> One-Click Plan Upgrades &amp; Renewals</li>
                </ul>
              </article>

              {/* Feature 2 */}
              <article className="feature-royal-card">
                <div className="card-header-icon">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <span className="card-sub-tag">AI WELLNESS CO-PILOT</span>
                <h3 className="feature-card-title">AI Yoga Assistant</h3>
                <p className="feature-card-desc">
                  An intelligent conversational co-pilot for yoga studio owners and practitioners. Obtain instantaneous
                  attendance telemetry, renewal forecasting, and class capacity metrics.
                </p>
                <ul className="feature-checklist">
                  <li><span className="check-bullet">✦</span> Predictive Renewal &amp; Retention Alerts</li>
                  <li><span className="check-bullet">✦</span> Conversational Query Resolution</li>
                  <li><span className="check-bullet">✦</span> Real-Time Class Attendance Insights</li>
                </ul>
              </article>

              {/* Feature 3 */}
              <article className="feature-royal-card">
                <div className="card-header-icon">
                  <i className="fa-solid fa-address-book"></i>
                </div>
                <span className="card-sub-tag">PRACTITIONER DIRECTORY</span>
                <h3 className="feature-card-title">Member Information Management</h3>
                <p className="feature-card-desc">
                  A unified, encrypted directory. Maintain practitioner dossiers, emergency contacts,
                  wellness preferences, and class visit history with instant filtering.
                </p>
                <ul className="feature-checklist">
                  <li><span className="check-bullet">✦</span> Centralized Practitioner Profiles</li>
                  <li><span className="check-bullet">✦</span> Instant Tag &amp; Class History Search</li>
                  <li><span className="check-bullet">✦</span> High-Standard Member Data Privacy</li>
                </ul>
              </article>

              {/* Feature 4 */}
              <article className="feature-royal-card">
                <div className="card-header-icon">
                  <i className="fa-solid fa-chart-line"></i>
                </div>
                <span className="card-sub-tag">REAL-TIME CHECK-IN</span>
                <h3 className="feature-card-title">Class &amp; Attendance Tracking</h3>
                <p className="feature-card-desc">
                  Monitor real-time studio verifications, class session limits, peak studio hours,
                  and upcoming renewal horizons via an intuitive, live dashboard.
                </p>
                <ul className="feature-checklist">
                  <li><span className="check-bullet">✦</span> Sub-Second QR Optical Pass Scanning</li>
                  <li><span className="check-bullet">✦</span> Automatic Session Balance Deductions</li>
                  <li><span className="check-bullet">✦</span> Live Studio Class Attendance Feeds</li>
                </ul>
              </article>
            </div>

            {/* Interactive Feature Demo Panel */}
            <div className="interactive-console-wrap">
              <div className="console-header">
                <div className="console-title">
                  <span className="console-icon">✦</span>
                  <span>Interactive Yoga Studio Console</span>
                </div>
                <div className="console-tabs" role="tablist">
                  <button
                    className={`tab-btn ${activeTab === 'tiers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tiers')}
                    role="tab"
                    aria-selected={activeTab === 'tiers'}
                  >
                    Yoga Tiers
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                    role="tab"
                    aria-selected={activeTab === 'ai'}
                  >
                    AI Yoga Assistant
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                    onClick={() => setActiveTab('telemetry')}
                    role="tab"
                    aria-selected={activeTab === 'telemetry'}
                  >
                    Studio Telemetry
                  </button>
                </div>
              </div>

              <div className="console-body">
                {activeTab === 'tiers' && (
                  <div className="tab-pane-content fade-in">
                    <div className="pane-split">
                      <div className="pane-narrative">
                        <h4>Class Allocation &amp; Tier Governance</h4>
                        <p>
                          Calibrate automated session allowances and validity periods. Practitioners view real-time
                          class usage and remaining sessions on their digital pass.
                        </p>
                        <div className="console-code-badge">
                          <code>RULE: Plan == &#39;Standard&#39; → 25 Yoga Sessions Included (30-Day Validity)</code>
                        </div>
                      </div>

                      <div className="pane-widget">
                        <div className="tier-pill-row">
                          <div className="tier-chip chip-classic">
                            <span className="chip-name">Basic</span>
                            <span className="chip-desc">10 Classes</span>
                          </div>
                          <div className="tier-chip chip-royale active-chip">
                            <span className="chip-name">Standard</span>
                            <span className="chip-desc">25 Classes</span>
                          </div>
                          <div className="tier-chip chip-sovereign">
                            <span className="chip-name">Premium</span>
                            <span className="chip-desc">Unlimited</span>
                          </div>
                        </div>

                        <div className="progress-box">
                          <div className="progress-header">
                            <span>Class Utilization: Maya Lin</span>
                            <span className="text-burgundy"><strong>18 / 25 Classes</strong> (72%)</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-bar" style={{ width: '72%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="tab-pane-content fade-in">
                    <div className="pane-split">
                      <div className="pane-narrative">
                        <h4>Conversational Studio Intelligence</h4>
                        <p>
                          Inquire directly regarding studio attendance, practitioner retention, and class schedules.
                          Select a prompt below or enter an inquiry:
                        </p>
                        <div className="prompt-chips-wrap">
                          <button className="prompt-pill" onClick={() => handleAiSimulate('renewals')}>
                            &quot;Who expires this week?&quot;
                          </button>
                          <button className="prompt-pill" onClick={() => handleAiSimulate('attendance')}>
                            &quot;Today&#39;s yoga class attendance&quot;
                          </button>
                          <button className="prompt-pill" onClick={() => handleAiSimulate('tiers')}>
                            &quot;Membership tier breakdown&quot;
                          </button>
                          <button className="prompt-pill" onClick={() => handleAiSimulate('passes')}>
                            &quot;Digital QR pass status&quot;
                          </button>
                        </div>
                      </div>

                      <div className="pane-widget chat-container">
                        <div className="chat-message-bubble">
                          <div className="chat-avatar-crest">✦</div>
                          <div className="chat-message-text">
                            <span className="chat-author">MemberPass Intelligence:</span>
                            <p>{aiResponse}</p>
                          </div>
                        </div>

                        <form className="console-chat-input" onSubmit={handleCustomAiSubmit}>
                          <input
                            type="text"
                            value={aiQuery}
                            onChange={(e) => setAiQuery(e.target.value)}
                            placeholder="Ask MemberPass AI (e.g. renewals, attendance, yoga passes)..."
                          />
                          <button type="submit" className="chat-send-btn" aria-label="Submit inquiry">
                            <i className="fa-solid fa-paper-plane"></i>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'telemetry' && (
                  <div className="tab-pane-content fade-in">
                    <div className="pane-split">
                      <div className="pane-narrative">
                        <h4>Live Studio Verification &amp; Check-In Stream</h4>
                        <p>
                          Sub-second telemetry captured across studio entrance turnstiles, private meditation rooms,
                          and wellness masterclasses.
                        </p>
                        <div className="status-online-pill">
                          <span className="pulsing-emerald"></span>
                          <span>Stream Live &amp; Encrypted</span>
                        </div>
                      </div>

                      <div className="pane-widget">
                        <div className="telemetry-feed">
                          <div className="feed-row">
                            <span className="feed-status-check">✓</span>
                            <div className="feed-details">
                              <strong>Maya Lin (Standard Plan)</strong>
                              <p>Verified for Morning Vinyasa Flow • 14s ago</p>
                            </div>
                            <span className="feed-badge-ok">VERIFIED</span>
                          </div>

                          <div className="feed-row">
                            <span className="feed-status-check">✓</span>
                            <div className="feed-details">
                              <strong>Arun Kumar (Basic Plan)</strong>
                              <p>Verified for Gentle Hatha Yoga • 2m ago</p>
                            </div>
                            <span className="feed-badge-ok">VERIFIED</span>
                          </div>

                          <div className="feed-row warning-row">
                            <span className="feed-status-warn">!</span>
                            <div className="feed-details">
                              <strong>Priya Devi (Standard Plan)</strong>
                              <p>2 classes remaining; pass expires in 3 days • Renewal notice queued</p>
                            </div>
                            <span className="feed-badge-warn">EXPIRING</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* =========================================================================
            5. MEMBERSHIP PLANS SECTION (DYNAMIC M2 & RAZORPAY INTEGRATION)
            ========================================================================= */}
          <PlansSection
            currentUser={currentUser}
            onRequireAuth={() => {
              setAuthModalMode('login')
              setAuthModalOpen(true)
            }}
            onPaymentSuccess={handlePaymentSuccess}
          />

          {/* =========================================================================
            6. TESTIMONIAL & TRUST SECTION
            ========================================================================= */}
          <section className="section-padding testimonials-section">
            <div className="section-header text-center">
              <span className="section-kicker">WELLNESS COMMUNITY</span>
              <h2 className="section-heading">Trusted by Our Wellness Community</h2>
              <p className="section-subtext">
                Discover how leading yoga studios, wellness retreats, and practitioners elevate class retention
                with MemberPass.
              </p>
            </div>

            <div className="testimonials-grid">
              <div className="testimonial-card">
                <div className="quote-mark">“</div>
                <p className="testimonial-quote">
                  MemberPass brought seamless poise to our yoga studio check-ins.
                  Our students love having an elegant, contactless digital QR pass on their phones,
                  and front-desk check-in time dropped from minutes to mere seconds.
                </p>
                <div className="author-row">
                  <div className="author-avatar">AS</div>
                  <div className="author-meta">
                    <strong>Ananya Sharma</strong>
                    <span>Founder &amp; Lead Instructor, Prana Yoga Sanctuary</span>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <div className="quote-mark">“</div>
                <p className="testimonial-quote">
                  The class utilization tracking and automated renewal reminders helped us increase student
                  retention by 35%. Our practitioners always know exactly how many sessions remain on their pass.
                </p>
                <div className="author-row">
                  <div className="author-avatar">DC</div>
                  <div className="author-meta">
                    <strong>David Chen</strong>
                    <span>Studio Director, Mindful Movement Shala</span>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <div className="quote-mark">“</div>
                <p className="testimonial-quote">
                  The aesthetic refinement of MemberPass aligns impeccably with our wellness values.
                  Our students appreciate the calm, instant digital experience, and our teachers love the accurate attendance logs.
                </p>
                <div className="author-row">
                  <div className="author-avatar">ER</div>
                  <div className="author-meta">
                    <strong>Elena Rostova</strong>
                    <span>Operations Lead, Lotus Blossom Yoga Collective</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
            7. HOW IT WORKS SECTION
            ========================================================================= */}
          <section className="section-padding workflow-section" id="workflow">
            <div className="section-header text-center">
              <span className="section-kicker">THE WORKFLOW</span>
              <h2 className="section-heading">Your Wellness Journey in Four Simple Steps</h2>
              <p className="section-subtext">
                A serene, modern pathway from studio enrollment to daily class attendance.
              </p>
            </div>

            <div className="workflow-steps-grid">
              <div className="workflow-step">
                <div className="step-numeral">01</div>
                <div className="step-icon">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <h3 className="step-title">Join the Yoga Centre</h3>
                <p className="step-desc">
                  Create your practitioner account online in under a minute with just your name, email,
                  and phone number.
                </p>
              </div>

              <div className="workflow-step">
                <div className="step-numeral">02</div>
                <div className="step-icon">
                  <i className="fa-solid fa-gears"></i>
                </div>
                <h3 className="step-title">Choose Your Membership</h3>
                <p className="step-desc">
                  Select the membership tier that suits your practice—Basic (10 classes), Standard (25 classes),
                  or Premium (unlimited sessions).
                </p>
              </div>

              <div className="workflow-step">
                <div className="step-numeral">03</div>
                <div className="step-icon">
                  <i className="fa-solid fa-id-card"></i>
                </div>
                <h3 className="step-title">Receive Your Digital QR Pass</h3>
                <p className="step-desc">
                  Instantly generate your personalized digital QR pass with encrypted pass code,
                  ready to display on any mobile device.
                </p>
              </div>

              <div className="workflow-step">
                <div className="step-numeral">04</div>
                <div className="step-icon">
                  <i className="fa-solid fa-chart-pie"></i>
                </div>
                <h3 className="step-title">Attend Classes &amp; Track Progress</h3>
                <p className="step-desc">
                  Present your QR code at the studio entrance for rapid scan-in, attend your yoga sessions,
                  and track remaining classes in real time.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================================
            8. CONTACT SECTION
            ========================================================================= */}
          <section className="section-padding contact-section" id="contact">
            <div className="contact-container">
              <div className="contact-info-col">
                <span className="section-kicker">CONNECT WITH US</span>
                <h2 className="contact-headline">Begin Your Wellness Journey</h2>
                <p className="contact-description">
                  Our studio wellness advisors are prepared to assist you with yoga memberships,
                  class schedules, or group wellness onboarding.
                </p>

                <div className="contact-meta-list">
                  <div className="contact-meta-item">
                    <div className="meta-icon"><i className="fa-solid fa-envelope"></i></div>
                    <div>
                      <span className="meta-caption">STUDIO INQUIRIES</span>
                      <a href="mailto:namaste@memberpass.com" className="meta-link">namaste@memberpass.com</a>
                    </div>
                  </div>

                  <div className="contact-meta-item">
                    <div className="meta-icon"><i className="fa-solid fa-location-dot"></i></div>
                    <div>
                      <span className="meta-caption">STUDIO SANCTUARY</span>
                      <span className="meta-static">Lotus Pavilion, Wellness District</span>
                    </div>
                  </div>

                  <div className="contact-meta-item">
                    <div className="meta-icon"><i className="fa-solid fa-clock"></i></div>
                    <div>
                      <span className="meta-caption">STUDIO HOURS</span>
                      <span className="meta-static">Monday – Sunday: 06:00 – 21:00 IST</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="contact-form-col">
                <div className="form-card">
                  <h3 className="form-card-title">Request Studio Consultation</h3>
                  <p className="form-card-sub">Inquire regarding personalized yoga memberships, private sessions, or studio enrollment.</p>

                  {contactSubmitted ? (
                    <div className="form-success-banner">
                      <span className="success-icon">✦</span>
                      <div>
                        <strong>Your Inquiry Has Been Received</strong>
                        <p>Our wellness coordinator will reach out to you within one business day.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="royale-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="name">Full Name <span className="req">*</span></label>
                          <input type="text" id="name" required placeholder="e.g. Maya Lin" />
                        </div>
                        <div className="form-group">
                          <label htmlFor="email">Official Email <span className="req">*</span></label>
                          <input type="email" id="email" required placeholder="e.g. maya.lin@example.com" />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="organization">Studio or Organization</label>
                        <input type="text" id="organization" placeholder="e.g. Lotus Yoga Studio or Individual" />
                      </div>

                      <div className="form-group">
                        <label htmlFor="interest">Tier of Interest</label>
                        <select id="interest" defaultValue="Standard Yoga Plan">
                          <option value="Basic Yoga Plan">Basic Yoga Pass (₹1,500 / 30 Days)</option>
                          <option value="Standard Yoga Plan">Standard Yoga Pass (₹3,000 / 30 Days)</option>
                          <option value="Premium Yoga Plan">Premium Yoga Pass (₹7,500 / 90 Days)</option>
                          <option value="Corporate / Private Wellness">Corporate / Private Wellness Group</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="message">Message or Requirements <span className="req">*</span></label>
                        <textarea id="message" rows="3" required placeholder="Share your wellness goals, preferred class schedule, or yoga membership questions..."></textarea>
                      </div>

                      <button type="submit" className="btn-primary btn-block">
                        <span>Submit Inquiry</span>
                        <span className="btn-arrow">→</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* =========================================================================
          9. REFINED FOOTER
          ========================================================================= */}
      <footer className="royale-footer">
        <div className="footer-inner">
          <div className="footer-top-row">
            <div className="footer-brand-col">
              <a href="#home" className="brand-logo footer-logo">
                <span className="crest-mark">
                  <span className="crest-monogram">M</span>
                  <span className="crest-sparkle">✦</span>
                </span>
                <div className="brand-text">
                  <span className="brand-name">Member<span className="highlight-rose">Pass</span></span>
                  <span className="brand-tag">YOGA &amp; WELLNESS</span>
                </div>
              </a>
              <p className="footer-tagline">
                The premier digital identity, class tracking, and membership management platform for contemporary yoga studios and wellness communities.
              </p>
              <div className="footer-social-icons">
                <a href="#home" aria-label="LinkedIn" className="social-pill"><i className="fa-brands fa-linkedin-in"></i></a>
                <a href="#home" aria-label="Twitter/X" className="social-pill"><i className="fa-brands fa-x-twitter"></i></a>
                <a href="#home" aria-label="Instagram" className="social-pill"><i className="fa-brands fa-instagram"></i></a>
              </div>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Navigation</h4>
              <ul className="footer-col-links">
                <li><a href="#home">Home Sanctuary</a></li>
                <li><a href="#about">Studio Philosophy</a></li>
                <li><a href="#features">Curated Capabilities</a></li>
                <li><a href="#plans">Membership Plans</a></li>
                <li><a href="#workflow">How It Works</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Membership Plans</h4>
              <ul className="footer-col-links">
                <li><a href="#plans">Basic Pass (10 Classes)</a></li>
                <li><a href="#plans">Standard Pass (25 Classes)</a></li>
                <li><a href="#plans">Premium Unlimited Pass</a></li>
                <li><a href="#contact">Private &amp; Corporate Wellness</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Studio Standards</h4>
              <p className="footer-col-text">
                Certified sub-second optical QR check-in. Real-time class capacity management and encrypted member data protection.
              </p>
              <div className="footer-pill-badge">
                <span>STUDIO GRADE ENCRYPTION • ISO 27001</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom-row">
            <p className="copyright-text">
              © 2026 <strong>MemberPass</strong>. All rights reserved. Yoga &amp; Wellness Membership Platform.
            </p>
            <div className="footer-legal-links">
              <a href="#home">Confidentiality Policy</a>
              <span className="dot-sep">•</span>
              <a href="#home">Terms of Membership</a>
              <span className="dot-sep">•</span>
              <button onClick={scrollToTop} className="back-top-link">
                Back to Top ↑
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Fullscreen Digital QR Pass Scanner Modal */}
      <QRPassModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  )
}


