import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '@/shared/utils/supabase';
import '@/styles/pages/admin.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // Add username state
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
  };

  const handleRegister = async () => {
    setError(null);
    // Supabase does not use username by default, but you can store it in user_metadata
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
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
        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!isRegistering}
        />
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