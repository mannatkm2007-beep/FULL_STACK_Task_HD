import { useEffect } from "react";
import ReactMarkdown from "react-markdown";

// The expanded "read the whole post" view.
// This file is loaded with React.lazy() from BrowsePosts, so the code for the
// expanded view is only downloaded the first time someone opens a post.

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Just now";
}

function PostModal({ post, onClose, onLike }) {
  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="browse__overlay" onClick={onClose}>
      <article
        className="browse__modal"
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="browse__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="browse__meta">
          <span className={`badge badge--${post.type}`}>{post.type === "article" ? "Article" : "Question"}</span>
          <span className={`badge ${post.plan === "paid" ? "badge--paid" : "badge--free"}`}>
            {post.plan === "paid" ? "Premium" : "Free"}
          </span>
          <span className="browse__author">
            {post.authorName} · {formatDate(post.createdAt)}
          </span>
        </div>

        <h2>{post.title}</h2>
        {post.type === "article" && post.abstract && <p className="browse__abstract">{post.abstract}</p>}

        <div className="browse__full">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>

        <div className="browse__foot">
          <div className="browse__tags">
            {post.tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
              </span>
            ))}
          </div>
          <button
            type="button"
            className={`like-btn ${post.likedByMe ? "like-btn--on" : ""}`}
            onClick={() => onLike(post)}
          >
            {post.likedByMe ? "Liked" : "Like"} · {post.likeCount}
          </button>
        </div>
      </article>
    </div>
  );
}

export default PostModal;
