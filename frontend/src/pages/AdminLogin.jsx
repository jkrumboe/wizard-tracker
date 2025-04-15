import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin.css";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = () => {
    if (username === "admin" && password === "securepassword") {
      localStorage.setItem("admin", true);
      navigate("/admin");
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="admin-login">
      <h1>Admin Login</h1>
      <div className="login-form">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error-message">{error}</p>}
        <button onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
};

export default AdminLogin;