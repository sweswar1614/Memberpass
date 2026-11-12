/**
 * MemberPass - AI-Powered Membership Management Platform
 * Frontend Interactive Logic
 * Features:
 *  - Header scroll state
 *  - Mobile navigation drawer toggle with outside-click detection
 *  - Active section observer for navigation links
 *  - Interactive 3D tilt effect on the Hero Pass card
 *  - Interactive Feature Preview Tabs
 *  - Interactive AI Assistant Simulation
 *  - Form validation with animated feedback
 *  - Animated statistic counters
 *  - Back-to-top button
 */

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================================
       1. NAVIGATION & SCROLL BEHAVIOR
       ========================================================================= */
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    const backToTopBtn = document.getElementById('backToTop');

    // Sticky header on scroll
    const handleScroll = () => {
        const scrollPos = window.scrollY;

        // Navbar blur intensity
        if (scrollPos > 30) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Back-to-top visibility
        if (scrollPos > 350) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    // Mobile Hamburger Menu Toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.contains('active');
            if (isOpen) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        // Close menu on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMobileMenu();
            });
        });

        // Close on clicking outside menu
        document.addEventListener('click', (e) => {
            if (navMenu.classList.contains('active') && 
                !navMenu.contains(e.target) && 
                !navToggle.contains(e.target)) {
                closeMobileMenu();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        });
    }

    function openMobileMenu() {
        navMenu.classList.add('active');
        navToggle.classList.add('open');
        navToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeMobileMenu() {
        navMenu.classList.remove('active');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    // Back to top click
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    /* =========================================================================
       2. ACTIVE SECTION OBSERVER (Scrollspy)
       ========================================================================= */
    const sections = document.querySelectorAll('section[id]');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentId = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    if (link.getAttribute('href') === `#${currentId}`) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));

    /* =========================================================================
       3. STATISTIC COUNTERS ANIMATION
       ========================================================================= */
    const counterElements = document.querySelectorAll('.counter');
    let countersAnimated = false;

    const animateCounters = () => {
        counterElements.forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target'));
            const isDecimal = target % 1 !== 0;
            const duration = 1600; // ms
            const stepTime = 20;
            const steps = duration / stepTime;
            const increment = target / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    counter.textContent = isDecimal ? target.toFixed(1) : Math.round(target);
                    clearInterval(timer);
                } else {
                    counter.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
                }
            }, stepTime);
        });
    };

    const heroSection = document.getElementById('home');
    if (heroSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !countersAnimated) {
                    countersAnimated = true;
                    animateCounters();
                }
            });
        }, { threshold: 0.3 });

        statsObserver.observe(heroSection);
    }

    /* =========================================================================
       4. INTERACTIVE 3D TILT EFFECT ON HERO PASS CARD
       ========================================================================= */
    const heroCard = document.getElementById('heroPassCard');
    if (heroCard && window.innerWidth > 992) {
        heroCard.addEventListener('mousemove', (e) => {
            const rect = heroCard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;

            heroCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        });

        heroCard.addEventListener('mouseleave', () => {
            heroCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
        });
    }

    /* =========================================================================
       5. INTERACTIVE FEATURE PREVIEW TABS
       ========================================================================= */
    const demoTabs = document.querySelectorAll('.demo-tab');
    const demoContents = document.querySelectorAll('.demo-tab-content');

    demoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');

            // Switch active tab button
            demoTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Switch tab content
            demoContents.forEach(content => {
                if (content.id === targetId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    /* =========================================================================
       6. AI ASSISTANT SIMULATION
       ========================================================================= */
    const aiResponseEl = document.getElementById('aiDemoResponse');
    const promptChips = document.querySelectorAll('.prompt-chip');
    const aiSimForm = document.getElementById('aiSimForm');
    const aiSimInput = document.getElementById('aiSimInput');

    const simulatedResponses = {
        renewals: '"38 members are scheduled for renewal this week. Automated reminders have been dispatched with an anticipated 94% retention rate."',
        stats: '"Today’s telemetry shows 214 successful check-ins across all access gates. Peak attendance was recorded at 10:15 AM."',
        members: '"Total active members: 1,482 across 4 tiers. 62 members unlocked Gold VIP status in the last 30 days."',
        tiers: '"Tier breakdown: Standard (58%), Silver (24%), Gold VIP (14%), Platinum (4%). All automated tier rules are synchronized."',
        passes: '"Digital pass engine status: 1,482 active passes with rotating 256-bit encryption tokens. 0 compromised credentials."'
    };

    const updateAiResponse = (text) => {
        if (!aiResponseEl) return;
        aiResponseEl.style.opacity = '0';
        setTimeout(() => {
            aiResponseEl.textContent = text;
            aiResponseEl.style.opacity = '1';
        }, 180);
    };

    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const queryKey = chip.getAttribute('data-query');
            if (simulatedResponses[queryKey]) {
                updateAiResponse(simulatedResponses[queryKey]);
            }
        });
    });

    if (aiSimForm) {
        aiSimForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = aiSimInput ? aiSimInput.value.trim().toLowerCase() : '';
            if (!query) return;

            let response = '"MemberPass AI: Platform telemetry is optimal. All membership records and automated rules are operating normally."';

            if (query.includes('renew') || query.includes('expir')) {
                response = simulatedResponses.renewals;
            } else if (query.includes('check') || query.includes('attend') || query.includes('today') || query.includes('scan')) {
                response = simulatedResponses.stats;
            } else if (query.includes('member') || query.includes('count') || query.includes('total') || query.includes('how many')) {
                response = simulatedResponses.members;
            } else if (query.includes('tier') || query.includes('vip') || query.includes('gold') || query.includes('level')) {
                response = simulatedResponses.tiers;
            } else if (query.includes('pass') || query.includes('qr') || query.includes('card') || query.includes('nfc')) {
                response = simulatedResponses.passes;
            }

            updateAiResponse(response);
            if (aiSimInput) aiSimInput.value = '';
        });
    }

    /* =========================================================================
       7. CONTACT FORM VALIDATION & INTERACTIVE FEEDBACK
       ========================================================================= */
    const contactForm = document.getElementById('contactForm');
    const formFeedback = document.getElementById('formFeedback');

    if (contactForm) {
        const nameInput = document.getElementById('contactName');
        const emailInput = document.getElementById('contactEmail');
        const subjectInput = document.getElementById('contactSubject');
        const messageInput = document.getElementById('contactMessage');
        const submitBtn = document.getElementById('submitBtn');

        const nameError = document.getElementById('nameError');
        const emailError = document.getElementById('emailError');
        const subjectError = document.getElementById('subjectError');
        const messageError = document.getElementById('messageError');

        const validateEmail = (email) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        };

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;

            // Clear previous errors
            [nameInput, emailInput, subjectInput, messageInput].forEach(input => {
                input.classList.remove('invalid');
            });
            nameError.textContent = '';
            emailError.textContent = '';
            subjectError.textContent = '';
            messageError.textContent = '';

            // Validate Name
            if (!nameInput.value.trim()) {
                nameInput.classList.add('invalid');
                nameError.textContent = 'Please enter your name.';
                isValid = false;
            }

            // Validate Email
            if (!emailInput.value.trim()) {
                emailInput.classList.add('invalid');
                emailError.textContent = 'Please enter your email address.';
                isValid = false;
            } else if (!validateEmail(emailInput.value.trim())) {
                emailInput.classList.add('invalid');
                emailError.textContent = 'Please enter a valid email address.';
                isValid = false;
            }

            // Validate Subject
            if (!subjectInput.value) {
                subjectInput.classList.add('invalid');
                subjectError.textContent = 'Please select an inquiry topic.';
                isValid = false;
            }

            // Validate Message
            if (!messageInput.value.trim()) {
                messageInput.classList.add('invalid');
                messageError.textContent = 'Please write your message.';
                isValid = false;
            } else if (messageInput.value.trim().length < 10) {
                messageInput.classList.add('invalid');
                messageError.textContent = 'Message should be at least 10 characters.';
                isValid = false;
            }

            // If valid, show success state
            if (isValid) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending Message...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Message Sent!</span> <i class="fa-solid fa-circle-check"></i>';
                    submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

                    // Display feedback card
                    formFeedback.style.display = 'flex';
                    contactForm.reset();

                    // Revert button text after 4 seconds
                    setTimeout(() => {
                        submitBtn.innerHTML = '<span>Send Message</span> <i class="fa-solid fa-paper-plane"></i>';
                        submitBtn.style.background = '';
                    }, 4000);
                }, 800);
            }
        });

        // Real-time error removal on input
        [nameInput, emailInput, subjectInput, messageInput].forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('invalid');
                const errElement = document.getElementById(input.name + 'Error');
                if (errElement) errElement.textContent = '';
            });
        });
    }

    console.log("MemberPass Landing Page initialized successfully.");
});
