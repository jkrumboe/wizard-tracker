import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/admin.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        username,
        password,
      });
      localStorage.setItem("token", response.data.token);
      const decoded = JSON.parse(atob(response.data.token.split(".")[1]));
      setTimeout(() => {
        if (decoded.role === "3") {
          navigate("/admin");
        } else {
          navigate("/");
          window.location.reload();
        }
      }, 0);
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid credentials");
    }
  };

  const handleRegister = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/register`, {
        username,
        email,
        password,
      });
      localStorage.setItem("token", response.data.token);
      const decoded = JSON.parse(atob(response.data.token.split(".")[1]));
      setTimeout(() => {
        if (decoded.role === "3") {
          navigate("/admin");
        } else {
          navigate("/");
          window.location.reload();
        }
      }, 0);
    } catch (err) {
      console.error("Registration error:", err);
      setError("Registration failed");
    }
  };

  return (
    <div className="login-page">
      <h1>{isRegistering ? "Register" : "Login"}</h1>
      <form className="login-form" onSubmit={(e) => { e.preventDefault(); isRegistering ? handleRegister() : handleLogin(); }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {isRegistering && (
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <input
          type="password"
          placeholder="Password"
          className="password-input"
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