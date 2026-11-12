import { useState, useEffect } from 'react'
import './App.css'

const CURRENT_YEAR = new Date().getFullYear()

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('home')

  // Inquiry Form State
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [toastMessage, setToastMessage] = useState(null)

  // Header scroll detection & active section observer
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30)

      const sectionIds = ['home', 'about', 'practices', 'benefits', 'philosophy', 'contact']
      const scrollPosition = window.scrollY + 160

      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveNav(id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Handle Contact Inquiry Form Submit
  const handleContactSubmit = (e) => {
    e.preventDefault()
    if (!contactName.trim() || !contactEmail.trim()) return

    setToastMessage({
      title: 'Inquiry Received',
      text: `Thank you, ${contactName}. A guide from our sanctuary will connect with you within 24 hours.`,
    })

    setContactName('')
    setContactEmail('')
    setContactMessage('')
  }

  // 4. Yoga Practices Data (The 5 Required Practices)
  const yogaPractices = [
    {
      id: 'hatha',
      name: 'Hatha Yoga',
      icon: 'fa-spa',
      description:
        'A foundational, grounding practice focusing on classical posture holds, structural alignment, and deliberate breath pacing. Cultivates physical stability, joint flexibility, and inner poise.',
    },
    {
      id: 'vinyasa',
      name: 'Vinyasa Yoga',
      icon: 'fa-wind',
      description:
        'A dynamic, seamless discipline where breath coordinates continuous transitions between standing and balancing postures. Builds internal warmth, cardiovascular endurance, and graceful flow.',
    },
    {
      id: 'ashtanga',
      name: 'Ashtanga Yoga',
      icon: 'fa-fire',
      description:
        'A structured, progressive series demanding synchronized breath and focused gaze (Drishti). Generates detoxifying internal heat, functional muscular strength, and unwavering concentration.',
    },
    {
      id: 'meditation',
      name: 'Meditation',
      icon: 'fa-brain',
      description:
        'Guided stillness, Vipassana awareness, and restful presence sessions. Designed to quiet cognitive chatter, release chronic mental fatigue, and establish a profound sense of clarity.',
    },
    {
      id: 'pranayama',
      name: 'Pranayama',
      icon: 'fa-lungs',
      description:
        'The classical yogic discipline of breath expansion and regulation. Utilizing conscious rhythm and diaphragmatic control to harmonize the nervous system and revitalize vital life energy.',
    },
  ]

  // 5. Benefits of Yoga Data
  const yogaBenefits = [
    {
      id: 'flexibility',
      title: 'Improved Flexibility',
      description:
        'Gradual and safe lengthening of muscle fibers and connective tissue, releasing stored tension and restoring natural range of motion throughout the spine and joints.',
    },
    {
      id: 'strength',
      title: 'Physical Strength',
      description:
        'Balanced, functional strength developed through bodyweight resistance, isometric holds, and core engagement without placing unnatural strain on delicate joints.',
    },
    {
      id: 'balance',
      title: 'Better Balance',
      description:
        'Cultivation of proprioceptive stability, neuromuscular coordination, and centered physical equilibrium that translates directly into everyday grace.',
    },
    {
      id: 'awareness',
      title: 'Mindful Awareness',
      description:
        'A heightened sensitivity to breath, physical posture, and emotional state, fostering intentional living and quiet presence both on and off the mat.',
    },
    {
      id: 'relaxation',
      title: 'Relaxation & Stress Management',
      description:
        'Systematic down-regulation of the sympathetic nervous system, lowering stress hormone circulation and allowing the body to enter restorative rest and recovery.',
    },
  ]

  return (
    <div className="zen-luxe-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="zen-toast" role="status" aria-live="polite">
          <div className="toast-gold-bar"></div>
          <div className="toast-body">
            <strong>{toastMessage.title}</strong>
            <p>{toastMessage.text}</p>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Close notification"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1 – NAVIGATION
          ========================================================================= */}
      <header className={`zen-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="zen-nav-container">
          {/* Left: MEMBERPASS Logo */}
          <a href="#home" className="zen-logo" aria-label="MemberPass Yoga Centre Home">
            <span className="logo-crest">M</span>
            <span className="logo-text">
              MEMBER<span className="gold-accent">PASS</span>
            </span>
          </a>

          {/* Right: Minimal Navigation Links (No Login, Signup, or Dashboard) */}
          <nav className="zen-desktop-nav">
            <a href="#home" className={`zen-nav-link ${activeNav === 'home' ? 'active' : ''}`}>
              Home
            </a>
            <a href="#about" className={`zen-nav-link ${activeNav === 'about' ? 'active' : ''}`}>
              About Us
            </a>
            <a
              href="#practices"
              className={`zen-nav-link ${activeNav === 'practices' ? 'active' : ''}`}
            >
              Yoga Practices
            </a>
            <a
              href="#benefits"
              className={`zen-nav-link ${activeNav === 'benefits' ? 'active' : ''}`}
            >
              Benefits
            </a>
            <a
              href="#contact"
              className={`zen-nav-link ${activeNav === 'contact' ? 'active' : ''}`}
            >
              Contact
            </a>
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className={`zen-mobile-toggle ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`zen-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <span className="drawer-kicker">MEMBERPASS SANCTUARY</span>
            <button
              type="button"
              className="drawer-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <nav className="drawer-nav">
            <a
              href="#home"
              onClick={() => setMobileMenuOpen(false)}
              className={`drawer-link ${activeNav === 'home' ? 'active' : ''}`}
            >
              Home
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className={`drawer-link ${activeNav === 'about' ? 'active' : ''}`}
            >
              About Us
            </a>
            <a
              href="#practices"
              onClick={() => setMobileMenuOpen(false)}
              className={`drawer-link ${activeNav === 'practices' ? 'active' : ''}`}
            >
              Yoga Practices
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className={`drawer-link ${activeNav === 'benefits' ? 'active' : ''}`}
            >
              Benefits
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className={`drawer-link ${activeNav === 'contact' ? 'active' : ''}`}
            >
              Contact
            </a>
          </nav>

          <div className="drawer-footer-info">
            <p className="drawer-address">108 Sanctuary Lane, Wellness Quarter, London W1</p>
            <p className="drawer-hours">Monday – Sunday: Open Daily</p>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 2 – HERO / INTRODUCTION
          ========================================================================= */}
      <section className="zen-hero-section" id="home">
        <div className="zen-container">
          <div className="hero-content-wrap">
            <div className="hero-kicker-row">
              <span className="gold-ornament-line"></span>
              <span className="hero-kicker-text">A SANCTUARY FOR MINDFUL YOGA</span>
              <span className="gold-ornament-line"></span>
            </div>

            <h1 className="hero-main-title">
              DISCOVER THE ART OF <span className="gold-title-accent">INNER BALANCE.</span>
            </h1>

            <p className="hero-supporting-text">
              Reconnect with your mind and body through mindful movement, traditional yoga practices
              and a journey towards holistic wellness.
            </p>

            <div className="hero-cta-group">
              <a href="#about" className="btn-gold-primary">
                <span>EXPLORE OUR CENTRE</span>
                <i className="fa-solid fa-arrow-right"></i>
              </a>

              <a href="#practices" className="btn-gold-outline">
                <span>DISCOVER YOGA</span>
              </a>
            </div>

            {/* Subtle Editorial Centre Descriptor */}
            <div className="hero-subtle-pillars">
              <div className="pillar-item">
                <span className="pillar-num">01</span>
                <span className="pillar-label">Traditional Lineages</span>
              </div>
              <div className="pillar-sep">✦</div>
              <div className="pillar-item">
                <span className="pillar-num">02</span>
                <span className="pillar-label">Peaceful Sanctuaries</span>
              </div>
              <div className="pillar-sep">✦</div>
              <div className="pillar-item">
                <span className="pillar-num">03</span>
                <span className="pillar-label">Guided Mindfulness</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 – ABOUT OUR CENTRE
          ========================================================================= */}
      <section className="zen-section-padding zen-about-section" id="about">
        <div className="zen-container">
          <div className="section-title-block">
            <span className="section-eyebrow">OUR SANCTUARY</span>
            <h2 className="section-heading-serif">A SPACE TO RECONNECT.</h2>
            <div className="gold-divider-center"></div>
          </div>

          <div className="about-split-layout">
            <div className="about-column">
              <h3 className="about-sub-title">Mindful Living & Physical Wellness</h3>
              <p>
                In a modern world characterized by relentless haste, our yoga centre provides an intentional
                pause. We cultivate mindful living by anchoring awareness into the present moment, allowing
                practitioners to release physical fatigue and restore deep structural vitality.
              </p>
              <p>
                Through conscious postural engagement and functional body alignments, our sessions build sustainable
                muscular strength, decompress the spine, and gently enhance joint mobility.
              </p>
            </div>

            <div className="about-column">
              <h3 className="about-sub-title">Traditional Practices & Mental Clarity</h3>
              <p>
                Our curriculum is anchored in authentic lineages of Hatha, Vinyasa, and Ashtanga yoga, paired
                with classical breathwork (Pranayama) and quiet meditative contemplation. Each practice is guided
                with attentiveness to individual pacing and body mechanics.
              </p>
              <p>
                Step inside a peaceful learning environment designed with natural textures, balanced acoustics,
                and subdued lighting—a sanctuary where quiet focus and internal calm naturally unfold.
              </p>
            </div>
          </div>

          {/* Clean 3-Point Editorial Bar */}
          <div className="about-values-strip">
            <div className="value-cell">
              <span className="value-gold-tag">MINDFULNESS</span>
              <p>Paced movements synchronizing breath, body awareness, and mental stillness.</p>
            </div>
            <div className="value-cell">
              <span className="value-gold-tag">ALIGNMENT</span>
              <p>Precise anatomical guidance honoring individual anatomy and safe progression.</p>
            </div>
            <div className="value-cell">
              <span className="value-gold-tag">TRANQUILITY</span>
              <p>A quiet studio environment protected from outside noise and digital intrusion.</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 – OUR YOGA PRACTICES
          ========================================================================= */}
      <section className="zen-section-padding zen-practices-section" id="practices">
        <div className="zen-container">
          <div className="section-title-block">
            <span className="section-eyebrow">THE DISCIPLINES</span>
            <h2 className="section-heading-serif">EXPLORE YOUR PRACTICE.</h2>
            <p className="section-intro-text">
              Each yogic pathway offers a distinct doorway to balance, strength, and inner stillness.
              Select the practice that resonates with your current physical and mental journey.
            </p>
            <div className="gold-divider-center"></div>
          </div>

          {/* Clean 5-Practice Grid */}
          <div className="practices-cards-grid">
            {yogaPractices.map((practice, index) => (
              <div key={practice.id} className="practice-luxe-card">
                <div className="card-header-row">
                  <div className="card-icon-frame">
                    <i className={`fa-solid ${practice.icon}`}></i>
                  </div>
                  <span className="card-number-tag">0{index + 1}</span>
                </div>

                <div className="card-gold-separator"></div>

                <h3 className="practice-card-title">{practice.name}</h3>
                <p className="practice-card-description">{practice.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 – THE BENEFITS OF YOGA
          ========================================================================= */}
      <section className="zen-section-padding zen-benefits-section" id="benefits">
        <div className="zen-container">
          <div className="section-title-block">
            <span className="section-eyebrow">HOLISTIC WELLBEING</span>
            <h2 className="section-heading-serif">BEYOND MOVEMENT. TOWARDS WELLNESS.</h2>
            <p className="section-intro-text">
              Consistent yoga practice extends profound biological and psychological benefits that enrich
              every aspect of daily life.
            </p>
            <div className="gold-divider-center"></div>
          </div>

          {/* Clean Editorial Benefits Grid */}
          <div className="benefits-editorial-layout">
            {yogaBenefits.map((benefit, index) => (
              <div key={benefit.id} className="benefit-editorial-item">
                <div className="benefit-num-col">
                  <span className="benefit-index font-serif">0{index + 1}</span>
                </div>
                <div className="benefit-text-col">
                  <h3 className="benefit-item-title">{benefit.title}</h3>
                  <p className="benefit-item-description">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6 – OUR PHILOSOPHY (Contrasting Warm Ivory Section)
          ========================================================================= */}
      <section className="zen-section-padding zen-philosophy-section" id="philosophy">
        <div className="zen-container">
          <div className="philosophy-container-box">
            <div className="section-title-block dark-mode-override">
              <span className="section-eyebrow dark-eyebrow">OUR CORE PHILOSOPHY</span>
              <h2 className="section-heading-serif dark-heading">WHERE MOVEMENT MEETS MINDFULNESS.</h2>
              <div className="gold-divider-center"></div>
            </div>

            <div className="philosophy-narrative">
              <p className="philosophy-lead-quote font-serif">
                “Yoga is not about touching your toes. It is about what you learn on the way down.”
              </p>

              <div className="philosophy-body-columns">
                <div className="philosophy-col">
                  <h4 className="phil-subhead">Conscious Movement</h4>
                  <p>
                    At MemberPass Yoga Centre, movement is treated as a moving meditation. Rather than viewing
                    postures as static shapes to achieve, we approach each asana as an inquiry into personal
                    boundaries, anatomical balance, and present-moment awareness.
                  </p>
                </div>

                <div className="philosophy-col">
                  <h4 className="phil-subhead">Sustainable Vitality</h4>
                  <p>
                    Holistic wellness cannot be rushed. Our approach honors gradual, non-competitive progression.
                    By harmonizing deliberate physical conditioning with restorative breathwork, we empower members
                    to cultivate resilience, prevent strain, and nourish lifetime vitality.
                  </p>
                </div>
              </div>

              <div className="philosophy-mantra-box">
                <span className="mantra-sparkle">✦</span>
                <p>A lifelong practice of harmony, self-compassion, and quiet strength.</p>
                <span className="mantra-sparkle">✦</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7 – CONTACT / VISIT US
          ========================================================================= */}

      {/* =========================================================================
          SECTION 7 – CONTACT / VISIT US
          ========================================================================= */}

      <section className="zen-contact-section" id="contact">
        <div className="zen-container">
          <div className="simple-contact">
            <h2>GET IN <span className="gold-accent">TOUCH.</span></h2>
            <p>We'd love to hear from you.</p>

            <a href="mailto:enquiries@memberpassyoga.com"
              className="btn-gold-primary">
              CONTACT US →
            </a>
          </div>
        </div>
      </section>



      {/* =========================================================================
          SECTION 8 – FOOTER
          ========================================================================= */}
      <footer className="zen-footer">
        <div className="zen-container">
          <div className="footer-top-grid">
            {/* Branding */}
            <div className="footer-brand-column">
              <a href="#home" className="zen-logo footer-logo">
                <span className="logo-crest">M</span>
                <span className="logo-text">
                  MEMBER<span className="gold-accent">PASS</span>
                </span>
              </a>
              <p className="footer-tagline">
                A luxury introductory sanctuary for traditional yoga, mindful breath, and holistic wellness.
              </p>
            </div>

            {/* Navigation Links */}
            <div className="footer-links-column">
              <h4 className="footer-links-heading">NAVIGATION</h4>
              <ul className="footer-nav-list">
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About Us</a></li>
                <li><a href="#practices">Yoga Practices</a></li>
                <li><a href="#benefits">Benefits</a></li>
                <li><a href="#philosophy">Our Philosophy</a></li>
                <li><a href="#contact">Contact & Visit</a></li>
              </ul>
            </div>

            {/* Practices Links */}
            <div className="footer-links-column">
              <h4 className="footer-links-heading">PRACTICES</h4>
              <ul className="footer-nav-list">
                <li><a href="#practices">Hatha Yoga</a></li>
                <li><a href="#practices">Vinyasa Yoga</a></li>
                <li><a href="#practices">Ashtanga Yoga</a></li>
                <li><a href="#practices">Meditation</a></li>
                <li><a href="#practices">Pranayama</a></li>
              </ul>
            </div>

            {/* Contact Summary */}
            <div className="footer-contact-column">
              <h4 className="footer-links-heading">SANCTUARY</h4>
              <p className="footer-contact-line">108 Sanctuary Lane, Wellness Quarter</p>
              <p className="footer-contact-line">London W1</p>
              <p className="footer-contact-line gold-text">+44 (0) 20 7946 0912</p>
              <p className="footer-contact-line">enquiries@memberpassyoga.com</p>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <p className="footer-copyright">
              © {CURRENT_YEAR} MemberPass Yoga Centre. All rights reserved. Zen Luxe Design System.
            </p>

            <button
              type="button"
              className="zen-back-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Scroll back to top"
            >
              <span>Back to Top</span>
              <i className="fa-solid fa-arrow-up"></i>
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
