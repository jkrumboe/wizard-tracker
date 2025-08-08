import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { account, ID } from '@/shared/utils/appwrite';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/pages/admin.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuthStatus } = useUser();

  const handleLogin = async () => {
    setError(null);
    try {
      await account.createEmailPasswordSession(email, password);
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
      await account.create(ID.unique(), email, password, name);
      // Automatically log in after successful registration
      await account.createEmailPasswordSession(email, password);
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
      <h1>{isRegistering ? "Register" : "Login"}</h1>
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
            disabled={!isRegistering}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="password-input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="button"
          className="switch-btn"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? "Switch to Login" : "Switch to Register"}
        </button>
        <button type="submit">
          {isRegistering ? "Register" : "Login"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default Login;