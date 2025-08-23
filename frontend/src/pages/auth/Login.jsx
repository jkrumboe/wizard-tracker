import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ID } from '@/shared/utils/appwrite';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import authService from '@/shared/api/authService';
import "@/styles/pages/login.css"


const Login = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuthStatus } = useUser();
  const { isOnline } = useOnlineStatus();

  const handleLogin = async () => {
    setError(null);
    
    if (!isOnline) {
      setError('Cannot login while in offline mode. Please wait for online mode to be enabled.');
      return;
    }
    
    try {
      await authService.login({ email, password });
      // Refresh the user context after successful login
      await refreshAuthStatus();
      
      // Navigate to the originally requested page or home
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message);
    }
  };

  const handleRegister = async () => {
    setError(null);
    
    if (!isOnline) {
      setError('Cannot register while in offline mode. Please wait for online mode to be enabled.');
      return;
    }
    
    try {
      await authService.register({ email, password, name });
      // Refresh the user context after successful registration
      await refreshAuthStatus();
      
      // Navigate to the originally requested page or home
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="login-page">
      {/* <h1>{isRegistering ? "Register" : "Login"}</h1> */}
      
      {!isOnline && (
        <div className="offline-notification" style={{ marginBottom: '1rem' }}>
          <p className="offline-message">
            <strong>Offline Mode:</strong> Authentication is currently disabled. 
            Please wait for online mode to be enabled.
          </p>
        </div>
      )}
      
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          isRegistering ? handleRegister() : handleLogin();
        }}
      >
        {isRegistering && (
          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isRegistering || !isOnline}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!isOnline}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="password-input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!isOnline}
          required
        />
        <button
          type="button"
          className="switch-btn"
          onClick={() => setIsRegistering(!isRegistering)}
          disabled={!isOnline}
        >
          {isRegistering ? "Sign In" : "No Account yet? Sign Up"}
        </button>
        <button type="submit" disabled={!isOnline}>
          {isRegistering ? "Sign Up" : "Sign In"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default Login;