import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/shared/hooks/useUser';
import authService from '@/shared/api/authService';
import "@/styles/pages/login.css"


const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { refreshAuthStatus } = useUser();

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      await authService.login({ username, password });
      // Refresh the user context after successful login
      await refreshAuthStatus();
      
      // Navigate to the originally requested page or home
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message || t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      await authService.register({ username: username, password });
      // Refresh the user context after successful registration
      await refreshAuthStatus();
      
      // Navigate to the originally requested page or home
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message || t('auth.registerFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          isRegistering ? handleRegister() : handleLogin();
        }}
      >
        <div className="login-header">
          <h2 className="login-title">{isRegistering ? t('auth.createAccountTitle') : t('auth.welcomeTitle')}</h2>
        </div>
        
        <div className="input-group">
          <label htmlFor="username" className="input-label">
            {t('auth.usernameLabel')}
          </label>
          <input
            id="username"
            type="text"
            placeholder={t('auth.usernamePlaceholder')}
            autoComplete="username"
            value={username}
            onChange={(e) => {
              // Remove any spaces from the input
              const usernameWithoutSpaces = e.target.value.replace(/\s/g, '');
              setUsername(usernameWithoutSpaces);
            }}
            disabled={isLoading}
            maxLength={20}
            required
          />
          {isRegistering && (
            <small className="input-hint">{t('auth.usernameHint')}</small>
          )}
        </div>
        
        <div className="input-group">
          <label htmlFor="password" className="input-label">
            {t('auth.passwordLabel')}
          </label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          {isRegistering && (
            <small className="input-hint">{t('auth.passwordHint')}</small>
          )}
        </div>
        
        {error && (
          <div className="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <button type="submit" className="submit-btn btn-primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              {isRegistering ? t('auth.creatingAccount') : t('auth.signingIn')}
            </>
          ) : (
            isRegistering ? t('auth.signUp') : t('auth.signIn')
          )}
        </button>
        
        <div className="divider">
          <span>or</span>
        </div>
        
        <button
          type="button"
          className="switch-btn"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError(null);
          }}
          disabled={isLoading}
        >
          {isRegistering ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
        </button>
      </form>

      <p className="login-subtitle">
            {isRegistering 
              ? t('auth.signUpSubtitle') 
              : t('auth.signInSubtitle')}
          </p>
    </div>
  );
};

export default Login;