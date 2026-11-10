import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { daysLeft, timeAgo } from "../utils/time";

// Author dashboard: shows the subscription status and a LIVE list of
// notifications (for example "Anna liked your article").
// New notifications appear here the moment they happen, without a refresh.
function Dashboard() {
  const { user, loading } = useAuth();
  const { items, unread, connected, markAllRead } = useNotifications();

  if (loading) return <main className="dashboard"><p className="browse__message">Loading…</p></main>;

  if (!user) {
    return (
      <main className="dashboard">
        <p className="browse__message">
          Please <Link to="/login">log in</Link> to see your dashboard.
        </p>
      </main>
    );
  }

  const remaining = daysLeft(user.trialEndsAt);

  return (
    <main className="dashboard">
      <div className="post__bar">My Dashboard</div>

      {/* ---------- Subscription ---------- */}
      <section className="dashboard__card">
        <h2>Your plan</h2>
        {user.subscription === "paid" && (
          <p>
            <span className="badge badge--paid">Premium</span> You can read all Free and Premium posts.
          </p>
        )}
        {user.subscription === "trial" && (
          <p>
            <span className="badge badge--paid">Premium trial</span> {remaining} day{remaining === 1 ? "" : "s"} left.{" "}
            <Link to="/pricing">Upgrade to keep Premium</Link>
          </p>
        )}
        {user.subscription === "free" && (
          <p>
            <span className="badge badge--free">Free</span>{" "}
            {user.trialUsed ? "Your free trial has ended. " : "Try Premium free for 7 days. "}
            <Link to="/pricing">See plans</Link>
          </p>
        )}
      </section>

      {/* ---------- Notifications ---------- */}
      <section className="dashboard__card">
        <div className="dashboard__head">
          <h2>
            Notifications {unread > 0 && <span className="badge badge--question">{unread} new</span>}
          </h2>
          <div className="dashboard__tools">
            <span className={`live ${connected ? "live--on" : "live--off"}`}>
              {connected ? "Live" : "Reconnecting…"}
            </span>
            <button type="button" onClick={markAllRead} disabled={unread === 0}>
              Mark all as read
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="browse__message">
            No notifications yet. When someone likes one of your posts, it shows up here instantly.
          </p>
        ) : (
          <ul className="notif__list">
            {items.map((n) => (
              <li key={n.id} className={`notif ${n.read ? "" : "notif--unread"}`}>
                <p>
                  <strong>{n.fromName}</strong> liked your post <em>“{n.postTitle}”</em>
                </p>
                <span>{timeAgo(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
