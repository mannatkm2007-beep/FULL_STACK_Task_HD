import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import NewPost from "./pages/NewPost";
import Pricing from "./pages/Pricing";
import BrowsePosts from "./pages/BrowsePosts";
import { useAuth } from "./context/AuthContext";
import "./App.css";

// The dashboard is only needed by logged-in users, so it is loaded on demand
const Dashboard = lazy(() => import("./pages/Dashboard"));

// Header and Footer sit outside <Routes>, so they appear
// identically on every page.
function App() {
  const { user } = useAuth();

  return (
    <div className="app">
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/post" element={<NewPost />} />
        <Route path="/pricing" element={<Pricing />} />
        {/* key makes Browse Posts start fresh (no hidden posts) when a different user logs in */}
        <Route path="/browse" element={<BrowsePosts key={user?.id ?? "visitor"} />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<p className="browse__message">Loading…</p>}>
              <Dashboard />
            </Suspense>
          }
        />
      </Routes>

      <Footer />
    </div>
  );
}

export default App;