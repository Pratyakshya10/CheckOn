import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react';
import { useAuth } from './auth-context';
import { GoogleIcon } from './google-icon';
import { isDemoLoginEnabled } from '../lib/demo-config';
import './auth.css';

export function AuthModal() {
  const {
    isAuthOpen,
    closeAuth,
    authMode,
    setAuthMode,
    authError,
    setAuthError,
    login,
    signup,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = authMode === 'sign-in';

  useEffect(() => {
    if (!isAuthOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event) => {
      if (event.key === 'Escape') closeAuth();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isAuthOpen, closeAuth]);

  useEffect(() => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError('');
    setInfoMsg('');
  }, [authMode]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  if (!isAuthOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfoMsg('');
    setAuthError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password, keepSignedIn);
      } else {
        await signup(fullName, email, password, confirmPassword, keepSignedIn);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      setInfoMsg('Enter your email above to receive password reset instructions.');
    } else {
      setInfoMsg(`Password reset link sent to ${email}`);
    }
  };

  return (
    <div className="checkon-auth-overlay" onClick={closeAuth} role="dialog" aria-modal="true" aria-labelledby="checkon-auth-heading">
      <div className="checkon-auth-dialog" onClick={(event) => event.stopPropagation()}>
        <img
          src="/assets/auth-corner-burst.png"
          alt=""
          aria-hidden="true"
          className="checkon-auth-corner-burst"
        />

        <button
          className="checkon-auth-close-btn"
          onClick={closeAuth}
          aria-label="Close dialog"
          type="button"
        >
          <X size={18} />
        </button>

        <div className="checkon-auth-grid">
          <div className="checkon-auth-left-col">
            <div className="checkon-auth-banner-wrap">
              <img
                src="/assets/auth-banner.png"
                alt="Stop checking. Start knowing. Get notified only when it matters."
                className="checkon-auth-banner-img"
              />
            </div>
          </div>

          <div className="checkon-auth-right-col">
            <div className="checkon-auth-header">
              <h2 className="checkon-auth-heading" id="checkon-auth-heading">
                {isLogin ? 'Welcome back!' : 'Create an account'}
              </h2>
              <p className="checkon-auth-subheading">
                {isLogin
                  ? 'Log in to continue monitoring what matters.'
                  : 'Start monitoring web changes in real-time.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="checkon-auth-form">
              {!isLogin && (
                <div className="checkon-input-group">
                  <User className="checkon-input-icon" size={18} />
                  <input
                    type="text"
                    className="checkon-input-field"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    autoComplete="name"
                    autoFocus
                  />
                </div>
              )}

              <div className="checkon-input-group">
                <Mail className="checkon-input-icon" size={18} />
                <input
                  type="email"
                  className="checkon-input-field"
                  placeholder="Email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  autoFocus={isLogin}
                />
              </div>

              <div className="checkon-input-group">
                <Lock className="checkon-input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="checkon-input-field"
                  placeholder={isLogin ? 'Password' : 'Password (min. 6 chars)'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="checkon-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {!isLogin && (
                <div className="checkon-input-group">
                  <Lock className="checkon-input-icon" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="checkon-input-field"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              )}

              {isLogin && (
                <div className="checkon-auth-options-row">
                  <label className="checkon-checkbox-label">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(event) => setKeepSignedIn(event.target.checked)}
                      className="checkon-checkbox-input"
                    />
                    <span>Keep me signed in</span>
                  </label>
                  <button
                    type="button"
                    className="checkon-forgot-link"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error && <div className="checkon-auth-msg error">{error}</div>}
              {infoMsg && <div className="checkon-auth-msg info">{infoMsg}</div>}

              <button
                type="submit"
                className="checkon-auth-submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'Please wait...' : isLogin ? 'Log in' : 'Sign up'}</span>
                <ArrowRight size={17} />
              </button>
            </form>

            <div className="checkon-auth-or-divider">
              <span>or</span>
            </div>

            <a href="/auth/google" className="checkon-auth-google-button">
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </a>

            {isDemoLoginEnabled() && (
              <div className="checkon-auth-demo-row">
                <a href="/auth/demo" className="checkon-auth-demo-link">
                  ⚡ Try Demo (No signup needed)
                </a>
              </div>
            )}

            <div className="checkon-auth-switch-footer">
              {isLogin ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="checkon-switch-button"
                    onClick={() => {
                      setError('');
                      setInfoMsg('');
                      setAuthError('');
                      setAuthMode('sign-up');
                    }}
                  >
                    <span className="checkon-switch-text">Sign up</span>
                    <span className="checkon-yellow-highlight" aria-hidden="true"></span>
                    <span className="checkon-switch-spark" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                        <path d="M4 14 L12 6" stroke="#FED049" strokeWidth="2.8" strokeLinecap="round" />
                        <path d="M10 16 L17 9" stroke="#FED049" strokeWidth="2.8" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="checkon-switch-button"
                    onClick={() => {
                      setError('');
                      setInfoMsg('');
                      setAuthError('');
                      setAuthMode('sign-in');
                    }}
                  >
                    <span className="checkon-switch-text">Log in</span>
                    <span className="checkon-yellow-highlight" aria-hidden="true"></span>
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
