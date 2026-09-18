import { useState, useEffect } from "react";
import { ArrowRight, LogOut, User } from "lucide-react";
import { useAuth } from "./auth/auth-context";
import { AuthModal } from "./auth/auth-modal";
import { Dashboard } from "./dashboard/Dashboard";

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [viewLandingOverride, setViewLandingOverride] = useState(false);
  const { user, openAuth, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // When user signs in, immediately show the Dashboard
  if (user && !viewLandingOverride) {
    return <Dashboard onSwitchToLanding={() => setViewLandingOverride(true)} />;
  }

  return (
    <div className="page-wrapper">
      <header className={`navbar ${isScrolled ? "scrolled" : ""}`}>
        <div
          className="site-container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
        >
          <a href="#" className="nav-brand" aria-label="CheckOn Home">
            <img src="/assets/logo.png" alt="CheckOn" className="brand-logo-img" />
          </a>

          <nav>
            <ul className="nav-links">
              <li>
                <a href="#how-it-works" className="nav-link">
                  Product
                </a>
              </li>
              <li>
                <a href="#example" className="nav-link">
                  Use cases
                </a>
              </li>
              <li>
                <a href="#why-checkon" className="nav-link">
                  Explore
                </a>
              </li>
              <li>
                <a href="#why-checkon" className="nav-link">
                  Pricing
                </a>
              </li>
            </ul>
          </nav>

          <div className="nav-actions">
            {user ? (
              <div className="user-profile-badge">
                <div className="user-avatar">
                  {user.fullName ? user.fullName[0].toUpperCase() : <User size={14} />}
                </div>
                <span className="user-name">{user.fullName}</span>
                <button
                  className="btn-signout"
                  onClick={() => {
                    void logout();
                  }}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <>
                <button className="btn-signin" onClick={() => openAuth("sign-in")}>
                  Sign in
                </button>
                <button className="btn-get-started" onClick={() => openAuth("sign-up")}>
                  Get Started <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="site-container">
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-tagline">
              <img src="/assets/accent-burst.png" alt="" className="hero-tagline-rays" />
              <span>LINK IT. WE'LL WATCH.</span>
            </div>

            <div className="hero-heading-wrap">
              <img src="/assets/hero-heading.png" alt="Be the first to know." className="hero-heading-img" />
            </div>

            <p className="hero-desc">
              Track any public webpage for real changes. Get notified only when it actually matters.
            </p>

            <div className="hero-actions">
              <button className="btn-hero-primary" onClick={() => openAuth("sign-up")}>
                Start watching — it's free <ArrowRight size={16} />
              </button>
              <a href="#example" className="btn-hero-secondary">
                See example
              </a>
            </div>

            <div className="hero-trust-note">No credit card. No spam. Just meaningful updates.</div>
          </div>

          <div className="hero-visual-wrap">
            <img
              src="/assets/hero-illustration.png"
              alt="Person working at desk with updates notification badges and coffee cup"
              className="hero-illustration-img"
            />
          </div>
        </section>

        <section className="how-it-works-section" id="how-it-works">
          <div className="section-eyebrow">HOW IT WORKS</div>
          <h2 className="section-title">Three simple steps.</h2>

          <div className="steps-row">
            <div className="step-item">
              <div className="step-num-badge">1</div>
              <div className="step-icon-box">
                <img src="/assets/icon-link.png" alt="Add a link" className="step-icon-img" />
              </div>
              <h3 className="step-title">Add a link</h3>
              <p className="step-desc">Paste any public URL you want to monitor.</p>
            </div>

            <div className="step-separator-arrow">
              <ArrowRight size={24} strokeWidth={1.6} />
            </div>

            <div className="step-item">
              <div className="step-num-badge">2</div>
              <div className="step-icon-box">
                <img src="/assets/icon-sliders.png" alt="Set what matters" className="step-icon-img" />
              </div>
              <h3 className="step-title">Set what matters</h3>
              <p className="step-desc">Tell us what kind of changes to look for.</p>
            </div>

            <div className="step-separator-arrow">
              <ArrowRight size={24} strokeWidth={1.6} />
            </div>

            <div className="step-item">
              <div className="step-num-badge">3</div>
              <div className="step-icon-box">
                <img src="/assets/icon-bell.png" alt="Get notified" className="step-icon-img" />
              </div>
              <h3 className="step-title">Get notified</h3>
              <p className="step-desc">We'll alert you only when there's a real change.</p>
            </div>
          </div>
        </section>

        <section className="diff-showcase-section" id="example">
          <div className="diff-content">
            <img src="/assets/badge-example.png" alt="EXAMPLE" className="badge-example-img" />
            <h2 className="diff-headline">
              A real change.
              <br />A useful alert.
            </h2>
            <p className="diff-subtitle">Here's how a simple update looks on CheckOn.</p>
            <div>
              <button className="btn-hero-primary" onClick={() => openAuth("sign-up")}>
                View live example <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="diff-preview-card-wrap">
            <img
              src="/assets/diff-card.png"
              alt="Example Page diff showing before and after changes"
              className="diff-card-main-img"
            />
          </div>
        </section>

        <section className="features-section" id="why-checkon">
          <div className="section-eyebrow">WHY PEOPLE USE CHECKON</div>
          <h2 className="section-title">Built for a more informed internet.</h2>

          <div className="features-grid">
            <div className="feature-box">
              <div className="feature-icon-container">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3 className="feature-heading">Works for any public website</h3>
              <p className="feature-text">News, product pages, documentation, listings — anything.</p>
            </div>

            <div className="feature-box">
              <div className="feature-icon-container">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="feature-heading">Shareable watches</h3>
              <p className="feature-text">One watch. Many subscribers. Keep your community informed.</p>
            </div>

            <div className="feature-box">
              <div className="feature-icon-container">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <h3 className="feature-heading">Smarter notifications</h3>
              <p className="feature-text">Filter out the noise. Get updates that actually matter.</p>
            </div>

            <div className="feature-box">
              <div className="feature-icon-container">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <h3 className="feature-heading">Always on</h3>
              <p className="feature-text">We check regularly, so you don't have to.</p>
            </div>
          </div>
        </section>

        <section className="cta-banner-section">
          <div className="cta-banner-card">
            <div className="cta-banner-left">
              <svg className="cta-curved-arrow" viewBox="0 0 44 44" fill="none" stroke="currentColor">
                <path
                  d="M 8 36 C 8 16, 20 8, 36 8 M 28 2 L 38 8 L 28 14"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <img src="/assets/cta-callout.png" alt="Stop checking. Start knowing." className="cta-callout-img" />
            </div>

            <div className="cta-banner-right">
              <div className="cta-action-wrap">
                <button className="btn-cta-submit" onClick={() => openAuth("sign-up")}>
                  Get Started — it's free <ArrowRight size={18} />
                </button>
                <span className="cta-subnote">Join thousands staying ahead.</span>
              </div>
              <img src="/assets/accent-burst.png" alt="" className="cta-burst-ray" />
            </div>
          </div>
        </section>
      </main>

      <footer className="site-container">
        <div className="footer-wrap">
          <div className="footer-left">
            <img src="/assets/logo.png" alt="CheckOn" className="footer-logo" />
          </div>

          <ul className="footer-nav">
            <li>
              <a href="#" className="footer-link">
                About
              </a>
            </li>
            <li>
              <a href="#" className="footer-link">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="footer-link">
                Terms
              </a>
            </li>
            <li>
              <a href="#" className="footer-link">
                Contact
              </a>
            </li>
          </ul>

          <div className="footer-tagline">A more informed internet, together.</div>
        </div>
      </footer>

      <AuthModal />
    </div>
  );
}
