import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/shared/hooks/useUser';
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

  const handleLogin = async () => {
    setError(null);
    
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
            required
          />
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <button type="submit" className="submit-btn">
          {isRegistering ? "Sign Up" : "Sign In"}
        </button>
        
        <button
          type="button"
          className="switch-btn"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? "Already have an account? Sign In" : "No account yet? Sign Up"}
        </button>
      </form>
    </div>
  );
};

export default Login;