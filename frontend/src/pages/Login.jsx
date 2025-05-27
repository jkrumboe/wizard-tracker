import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from '../hooks/useUser';
import authService from '../services/authService';
import "../styles/admin.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();  const handleLogin = async () => {
    try {
      const response = await authService.login({
        username,
        password,
      });
      
      // Use the user info directly from the response
      setUser(response.user);
      
      // Instead of page reload, navigate directly
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid credentials");
    }
  };    const handleRegister = async () => {
    try {
      const response = await authService.register({
        username,
        email,
        password,
      });
      
      // Use the user info directly from the response
      setUser(response.user);
      
      // Navigate based on user role
      if (response.user.role === 3) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Registration failed");
    }
  };

  return (
    <div className="login-page">
      <h1>{isRegistering ? "Register" : "Login"}</h1>
      <form className="login-form" onSubmit={(e) => { e.preventDefault(); isRegistering ? handleRegister() : handleLogin(); }}>        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {isRegistering && (          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}        <input
          type="password"
          placeholder="Password"
          className="password-input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="switch-btn" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? "Switch to Login" : "Switch to Register"}
        </button>
        <button type="submit">{isRegistering ? "Register" : "Login"}</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default Login;