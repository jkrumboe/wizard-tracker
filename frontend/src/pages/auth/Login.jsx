import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import authService from '@/shared/api/authService';
import "@/styles/pages/login.css"


const Login = () => {
  const [username, setUsername] = useState('');
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
      await authService.login({ username, password });
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
      await authService.register({ username: username, password });
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
        <h2 className="login-title">{isRegistering ? "Create Account" : "Welcome Back"}</h2>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!isOnline}
            required
          />
        </div>
        
        <div className="input-group">
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!isOnline}
            required
          />
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <button type="submit" className="submit-btn" disabled={!isOnline}>
          {isRegistering ? "Sign Up" : "Sign In"}
        </button>
        
        <button
          type="button"
          className="switch-btn"
          onClick={() => setIsRegistering(!isRegistering)}
          disabled={!isOnline}
        >
          {isRegistering ? "Already have an account? Sign In" : "No account yet? Sign Up"}
        </button>
      </form>
    </div>
  );
};

export default Login;