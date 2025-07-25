import React, { useState } from "react";
import { account, ID } from "@/app/appwrite.jsx";
import { useNavigate } from "react-router-dom";
// import "@/styles/pages/admin.css";

const Login = () => {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  async function login(email, password) {
    try {
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      setLoggedInUser(user);
      setError(null);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid credentials");
    }
  }

  async function register(email, password, name) {
    try {
      await account.create(ID.unique(), email, password, name);
      await login(email, password);
      setError(null);
    } catch (err) {
      setError(err.message || "Registration failed");
    }
  }

  async function logout() {
    await account.deleteSession("current");
    setLoggedInUser(null);
    setError(null);
  }

  return (
    <div className="login-page">
      <h1>{isRegistering ? "Register" : "Login"}</h1>
      <form
        className="login-form"
        onSubmit={e => {
          e.preventDefault();
          isRegistering
            ? register(email, password, name)
            : login(email, password);
        }}
      >
        {!isRegistering && (
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        )}
        {isRegistering && (
          <>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="text"
              placeholder="Name"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </>
        )}
        <input
          type="password"
          placeholder="Password"
          className="password-input"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="switch-btn"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? "Switch to Login" : "Switch to Register"}
        </button>
        <button type="submit">{isRegistering ? "Register" : "Login"}</button>
        {loggedInUser && (
          <button type="button" onClick={logout}>
            Logout
          </button>
        )}
        {error && <p className="error-message">{error}</p>}
      </form>
      <p>
        {loggedInUser ? `Logged in as ${loggedInUser.name}` : "Not logged in"}
      </p>
    </div>
  );
};

export default Login;
