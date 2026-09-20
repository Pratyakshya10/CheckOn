import { lazy, Suspense, useState, useEffect, type FormEvent } from "react";
import {
  ArrowRight,
  LogOut,
  User,
  Plane,
  ShoppingCart,
  FileText,
  Briefcase,
  Landmark,
  Globe,
  Link2,
  SlidersHorizontal,
  Bell,
  ExternalLink,
} from "lucide-react";
import { backendApi, type TrialCheckResponse } from "./api/backend-client";
import { useAuth } from "./auth/auth-context";
import { AuthModal } from "./auth/auth-modal";

const Dashboard = lazy(() =>
  import("./dashboard/Dashboard").then((module) => ({ default: module.Dashboard })),
);

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [viewLandingOverride, setViewLandingOverride] = useState(false);
  const [trialUrl, setTrialUrl] = useState("");
  const [trialCondition, setTrialCondition] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState("");
  const [trialResult, setTrialResult] = useState<TrialCheckResponse | null>(null);
  const { user, openAuth, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTrialSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTrialError("");
    setTrialResult(null);
    setTrialLoading(true);
    try {
      const url = trialUrl.startsWith("http") ? trialUrl : `https://${trialUrl}`;
      setTrialResult(
        await backendApi.trialCheck({
          url,
          conditionText: trialCondition.trim() || "any meaningful content change",
        }),
      );
    } catch (error) {
      setTrialError(error instanceof Error ? error.message : "The trial check could not run.");
    } finally {
      setTrialLoading(false);
    }
  };

  // When user signs in, immediately show the Dashboard
  if (user && !viewLandingOverride) {
    return (
      <Suspense fallback={<div className="page-loading">Loading your dashboard…</div>}>
        <Dashboard onSwitchToLanding={() => setViewLandingOverride(true)} />
      </Suspense>
    );
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
              <a className="btn-hero-primary" href="#try-it">
                Start watching — it's free <ArrowRight size={16} />
              </a>
              <a href="#example" className="btn-hero-secondary">
                See example
              </a>
            </div>

            <div className="hero-social-proof">
              <img
                src="/assets/doodle-avatars.png"
                alt="Community members"
                className="hero-doodle-avatars"
              />
              <span className="hero-proof-text">Join the queue for early access.</span>
            </div>
          </div>

          <div className="hero-visual-wrap">
            <img
              src="/assets/hero-illustration.png"
              alt="Person working at desk with updates notification badges and coffee cup"
              className="hero-illustration-img"
            />
          </div>
        </section>

        <section className="trial-section" id="try-it">
          <div className="trial-card">
            <div className="trial-copy">
              <span className="section-eyebrow">TRY IT WITHOUT SIGNING UP</span>
              <h2 className="trial-title">Check one public page now.</h2>
              <p className="trial-description">
                Paste a URL and describe the change you care about. We will fetch the live page and tell you what is there.
              </p>
            </div>

            <form className="trial-form" onSubmit={handleTrialSubmit}>
              <label className="trial-label" htmlFor="trial-url">Public webpage</label>
              <input
                id="trial-url"
                className="trial-input"
                type="text"
                inputMode="url"
                placeholder="example.com/notices"
                value={trialUrl}
                onChange={(event) => setTrialUrl(event.target.value)}
                required
              />
              <label className="trial-label" htmlFor="trial-condition">Tell me if...</label>
              <input
                id="trial-condition"
                className="trial-input"
                type="text"
                placeholder="the application deadline changes"
                value={trialCondition}
                onChange={(event) => setTrialCondition(event.target.value)}
              />
              <button className="trial-submit" type="submit" disabled={trialLoading}>
                {trialLoading ? "Checking the live page..." : "Run free check"}
                {!trialLoading && <ArrowRight size={16} />}
              </button>
            </form>

            {trialError && <div className="trial-message error" role="alert">{trialError}</div>}
            {trialResult && (
              <div className={`trial-message ${trialResult.matched ? "matched" : "ready"}`} aria-live="polite">
                <strong>{trialResult.matched ? "Your condition currently matches." : "Live check complete."}</strong>
                <span>{trialResult.matchReason || trialResult.currentState}</span>
                <button type="button" onClick={() => openAuth("sign-up")}>Save this watch</button>
              </div>
            )}
          </div>
        </section>

        <section className="use-cases-section" id="use-cases">
          <div className="use-cases-header">
            <div className="use-cases-title-col">
              <img
                src="/assets/use-cases-heading.png"
                alt="If it's public, you can watch it."
                className="use-cases-heading-img"
              />
            </div>
            <div className="use-cases-desc-col">
              <p className="use-cases-desc">
                From ticket availability to job updates —
                <br />
                CheckOn works on any public website.
              </p>
            </div>
            <div className="use-cases-doodle-col">
              <img
                src="/assets/different-use-cases-doodle.png"
                alt="Different use cases, same peace of mind."
                className="use-cases-doodle-img"
              />
            </div>
          </div>

          <div className="use-cases-grid">
            <div className="use-case-card">
              <div className="use-case-icon">
                <Plane size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">Travel &amp; Tickets</h3>
              <p className="use-case-desc">Flight, train, event tickets</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-icon">
                <ShoppingCart size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">Price Drops</h3>
              <p className="use-case-desc">Get notified when prices change</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-icon">
                <FileText size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">College Portals</h3>
              <p className="use-case-desc">Notices, results, admissions</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-icon">
                <Briefcase size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">Job Openings</h3>
              <p className="use-case-desc">New listings at your dream companies</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-icon">
                <Landmark size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">Government Sites</h3>
              <p className="use-case-desc">Policy updates, tenders, schemes</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-icon">
                <Globe size={28} strokeWidth={1.8} />
              </div>
              <h3 className="use-case-title">Any Website</h3>
              <p className="use-case-desc">If it's public, you can track it.</p>
            </div>
          </div>
        </section>

        <section className="how-it-works-section" id="how-it-works">
          <div className="how-it-works-card">
            <div className="how-it-works-header">
              <div>
                <div className="section-eyebrow">HOW IT WORKS</div>
                <h2 className="how-it-works-title">Three simple steps.</h2>
              </div>
              <img
                src="/assets/takes-less-doodle.png"
                alt="Takes less than a minute!"
                className="takes-less-doodle"
              />
            </div>

            <div className="steps-row">
              <div className="step-item">
                <div className="step-num-badge">1</div>
                <div className="step-icon-box">
                  <Link2 size={30} strokeWidth={2} />
                </div>
                <h3 className="step-title">Add a link</h3>
                <p className="step-desc">Paste any public URL you want to monitor.</p>
              </div>

              <div className="step-separator-arrow">
                <ArrowRight size={22} strokeWidth={1.6} />
              </div>

              <div className="step-item">
                <div className="step-num-badge">2</div>
                <div className="step-icon-box">
                  <SlidersHorizontal size={30} strokeWidth={2} />
                </div>
                <h3 className="step-title">Set what matters</h3>
                <p className="step-desc">Tell us what kind of changes to look for.</p>
              </div>

              <div className="step-separator-arrow">
                <ArrowRight size={22} strokeWidth={1.6} />
              </div>

              <div className="step-item">
                <div className="step-num-badge">3</div>
                <div className="step-icon-box">
                  <Bell size={30} strokeWidth={2} />
                </div>
                <h3 className="step-title">Get notified</h3>
                <p className="step-desc">We'll alert you only when there's a real change.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="diff-showcase-section" id="example">
          <div className="diff-card-container">
            <div className="diff-content">
              <div className="section-eyebrow">EXAMPLE</div>
              <h2 className="diff-headline">
                A real change.
                <br />
                A useful alert.
              </h2>
              <p className="diff-subtitle">Here's how a simple update looks on CheckOn.</p>
              <div className="no-more-refreshing-wrap">
                <img
                  src="/assets/no-more-refreshing.png"
                  alt="No more refreshing."
                  className="no-more-refreshing-doodle"
                />
              </div>
            </div>

            <div className="diff-visual-area">
              {/* Before Card */}
              <div className="browser-diff-card card-before">
                <div className="browser-header">
                  <div className="browser-traffic-dots">
                    <span className="dot dot-red"></span>
                    <span className="dot dot-yellow"></span>
                    <span className="dot dot-green"></span>
                  </div>
                  <div className="browser-tab-info">
                    <FileText size={14} className="browser-tab-icon" />
                    <span className="browser-tab-title">Example Page</span>
                    <span className="browser-tab-url">http://example.com</span>
                    <ExternalLink size={12} className="browser-tab-ext" />
                  </div>
                </div>
                <div className="browser-body">
                  <div className="diff-badge badge-before">Before</div>
                  <div className="skeleton-lines">
                    <div className="skeleton-bar bar-w100"></div>
                    <div className="skeleton-bar bar-w60"></div>
                    <div className="diff-highlight diff-highlight-removed">
                      <span className="diff-symbol">-</span>
                      <div className="diff-highlight-bar bar-removed"></div>
                    </div>
                    <div className="skeleton-bar bar-w80"></div>
                    <div className="skeleton-bar bar-w50"></div>
                  </div>
                </div>
              </div>

              {/* Arrow between cards */}
              <div className="diff-flow-arrow">
                <ArrowRight size={24} strokeWidth={1.8} />
              </div>

              {/* After Card */}
              <div className="browser-diff-card card-after">
                <div className="browser-header">
                  <div className="browser-traffic-dots">
                    <span className="dot dot-red"></span>
                    <span className="dot dot-yellow"></span>
                    <span className="dot dot-green"></span>
                  </div>
                  <div className="browser-tab-info">
                    <FileText size={14} className="browser-tab-icon" />
                    <span className="browser-tab-title">Example Page</span>
                    <span className="browser-tab-url">https://example.com</span>
                  </div>
                  <div className="change-detected-pill">
                    <span className="detected-label">Change detected</span>
                    <span className="detected-time">12 Sep, 2026 • 10:31 AM</span>
                  </div>
                </div>
                <div className="browser-body">
                  <div className="diff-badge badge-after">After</div>
                  <div className="skeleton-lines">
                    <div className="skeleton-bar bar-w100"></div>
                    <div className="skeleton-bar bar-w60"></div>
                    <div className="diff-highlight diff-highlight-added">
                      <span className="diff-symbol">+</span>
                      <div className="diff-highlight-bar bar-added"></div>
                    </div>
                    <div className="skeleton-bar bar-w80"></div>
                    <div className="skeleton-bar bar-w50"></div>
                  </div>
                </div>
              </div>

              {/* Doodle on right */}
              <div className="from-this-wrap">
                <img
                  src="/assets/from-this-to-this.png"
                  alt="From this... to this. Automatically."
                  className="from-this-doodle"
                />
              </div>
            </div>
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
              <img
                src="/assets/one-less-thing-banner.png"
                alt="One less thing to remember. Leave the checking to us. You've got better things to do."
                className="cta-left-composite-img"
              />
            </div>

            <div className="cta-banner-center">
              <p className="cta-center-text">
                Let CheckOn handle the monitoring,
                <br />
                so you can focus on what matters.
              </p>
              <button className="btn-cta-submit" onClick={() => openAuth("sign-up")}>
                Get Started — it's free <ArrowRight size={18} />
              </button>
              <span className="cta-subnote">No credit card. No spam.</span>
            </div>

            <div className="cta-banner-right">
              <img
                src="/assets/things-to-check-illustration.png"
                alt="Things to check clipboard, sticky note, and A more informed internet for a brighter you doodle"
                className="cta-illustration-img"
              />
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
