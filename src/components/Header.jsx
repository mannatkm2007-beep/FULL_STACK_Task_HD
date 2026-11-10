import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationsContext";

// Header matches the wireframe: DEV@Deakin (links home), search bar, Post, Login.
// Post opens the New Post page (Task C1). Pricing/Login/Logout added in Task D1. Search will be implemented in a future task.
function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unread } = useNotifications();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="header">
      <Link to="/" className="header__logo">
        DEV@Deakin
      </Link>

      <div className="header__search">
        <Search size={18} />
        <input type="text" placeholder="Search..." />
      </div>

      <nav className="header__actions">
        <Link to="/browse">Browse Posts</Link>
        <Link to="/post">Post</Link>
        <Link to="/pricing">Pricing</Link>
        {user && (
          <Link to="/dashboard" className="header__dash">
            Dashboard
            {unread > 0 && <span className="header__count">{unread}</span>}
          </Link>
        )}
        <button type="button" className="header__theme" onClick={toggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        {user ? (
          <>
            <span className="header__user">
              Hi, {user.firstName}
              {user.subscription === "paid" && <span className="badge badge--paid">Premium</span>}
              {user.subscription === "trial" && <span className="badge badge--paid">Trial</span>}
            </span>
            <button type="button" className="header__logout" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
}

export default Header;