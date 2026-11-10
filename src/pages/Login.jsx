import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, API_URL } from "../context/AuthContext";

// Login page: sends the email + password to the Express backend.
// On success the backend returns a signed JWT, which we store via AuthContext.
function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Send the details to the backend
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (res.status === 401 || res.status === 400) {
        setError("wrong");
        return;
      }
      if (!res.ok) throw new Error(data.message);

      // 2. Store the JWT (localStorage) and the user in context
      login(data.token, data.user);

      // 3. Correct details -> redirect to the home page
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      setError("server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth__box">
        <div className="auth__topright">
          <Link to="/signup" className="auth__signup-btn">Sign up</Link>
        </div>

        <form onSubmit={handleSubmit} className="auth__form">
          <label htmlFor="email">Your email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Your password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error === "wrong" && (
            <p className="auth__error">
              Incorrect email or password. Please try again, or{" "}
              <Link to="/signup">sign up for a free account</Link>.
            </p>
          )}
          {error === "server" && (
            <p className="auth__error">Something went wrong. Please try again.</p>
          )}

          <button type="submit" className="auth__submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Login;