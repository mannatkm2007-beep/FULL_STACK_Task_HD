import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useOptimistic,
  useDeferredValue,
  useTransition,
  startTransition,
  lazy,
  Suspense,
} from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth, API_URL } from "../context/AuthContext";

// Loaded only when a post is opened (keeps the first page load small)
const PostModal = lazy(() => import("../components/PostModal"));

const PAGE_SIZE = 10;
const emptyFilters = { search: "", type: "all", plan: "all", tag: "", from: "", to: "" };

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Just now";
}

// Short plain-text preview of a post (the full text opens when it is expanded)
function previewOf(post) {
  const text = post.type === "article" && post.abstract ? post.abstract : post.body;
  const plain = text.replace(/[#*_`>~-]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 160 ? plain.slice(0, 160) + "…" : plain;
}

function BrowsePosts() {
  const { user, token, loading: authLoading } = useAuth();

  // ----- Data that comes from the backend -----
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [viewerPlan, setViewerPlan] = useState("free");
  const [subscription, setSubscription] = useState("free");
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [fetching, setFetching] = useState(false); // first page being (re)loaded
  const [loadingMore, setLoadingMore] = useState(false);

  // ----- Things only this user's screen cares about -----
  const [filters, setFilters] = useState(emptyFilters);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [order, setOrder] = useState(null); // custom order after dragging (array of ids)
  const [dragId, setDragId] = useState(null);
  const [openId, setOpenId] = useState(null);

  // useTransition: changing a dropdown/date is a low-priority update, so typing
  // and clicking stay smooth while the list re-renders.
  const [isPending, startFilterTransition] = useTransition();

  // useDeferredValue: the search box updates instantly, but we only ask the
  // backend once the user has paused typing (the deferred value lags behind).
  const deferredSearch = useDeferredValue(filters.search);

  const abortRef = useRef(null); // cancels in-flight requests when filters change
  const sentinelRef = useRef(null); // invisible element at the bottom of the list

  // The filters turned into a query string for the backend (empty ones are left out)
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (deferredSearch.trim()) params.set("q", deferredSearch.trim());
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.plan !== "all") params.set("plan", filters.plan);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    return params.toString();
  }, [deferredSearch, filters.type, filters.plan, filters.tag, filters.from, filters.to]);

  // Asks the backend for one page of posts.
  // The backend works out which posts this visitor/user is allowed to see.
  const requestPage = useCallback(
    async (pageNumber, signal) => {
      const res = await fetch(`${API_URL}/api/posts?${queryString}&page=${pageNumber}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    [queryString, token]
  );

  // Load page 1 on first visit, and again whenever the filters, the logged-in
  // user, or their plan (upgrade / trial) changes.
  useEffect(() => {
    if (authLoading) return;

    abortRef.current?.abort(); // cancel the previous request, if any
    const controller = new AbortController();
    abortRef.current = controller;

    async function loadFirstPage() {
      setFetching(true);
      try {
        const data = await requestPage(1, controller.signal);
        setPosts(data.posts);
        setPage(1);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setAllTags(data.tags);
        setViewerPlan(data.plan);
        setSubscription(data.subscription);
        setOrder(null);
        setStatus("ready");
      } catch (err) {
        if (err.name !== "AbortError") setStatus("error");
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    }

    loadFirstPage();
    return () => controller.abort();
  }, [authLoading, requestPage, user?.subscription]);

  // Load the next page and add it to the end of the list
  const loadMore = useCallback(async () => {
    if (loadingMore || fetching || !hasMore || !abortRef.current) return;

    const signal = abortRef.current.signal; // cancelled automatically if filters change
    setLoadingMore(true);
    try {
      const data = await requestPage(page + 1, signal);
      setPosts((prev) => [...prev, ...data.posts.filter((p) => !prev.some((x) => x.id === p.id))]);
      setPage(page + 1);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (err.name !== "AbortError") {
        Swal.fire({ icon: "error", title: "Could not load more posts", text: "Please try again." });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, fetching, hasMore, requestPage, page]);

  // Infinite scroll: when the invisible element at the bottom scrolls into view, load more
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadMore, status]);

  // ----- Likes with useOptimistic -----
  // The like count changes on screen immediately. If the request fails,
  // React automatically goes back to the real data in "posts".
  const [optimisticPosts, applyLike] = useOptimistic(posts, (current, postId) =>
    current.map((p) =>
      p.id === postId
        ? { ...p, likedByMe: !p.likedByMe, likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)) }
        : p
    )
  );

  function handleLike(post) {
    if (!token) {
      Swal.fire({ icon: "info", title: "Please log in", text: "You need to be logged in to like a post." });
      return;
    }

    startTransition(async () => {
      applyLike(post.id); // instant, temporary change

      try {
        const res = await fetch(`${API_URL}/api/posts/${post.id}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Could not update your like.");

        // Replace the guess with the real numbers from the server
        startTransition(() => {
          setPosts((prev) =>
            prev.map((p) => (p.id === post.id ? { ...p, likedByMe: data.liked, likeCount: data.likeCount } : p))
          );
        });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Like not saved", text: err.message });
      }
    });
  }

  // ----- What is shown: custom order, minus the posts this user hid -----
  const visible = useMemo(() => {
    let list = optimisticPosts;
    if (order) {
      const rank = new Map(order.map((id, i) => [id, i]));
      list = [...optimisticPosts].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
    }
    return list.filter((p) => !hiddenIds.includes(p.id));
  }, [optimisticPosts, order, hiddenIds]);

  const openPost = optimisticPosts.find((p) => p.id === openId) || null;

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  const canReset = isFiltered || hiddenIds.length > 0 || order !== null;

  // Text typing updates straight away; dropdowns and dates go through a transition
  function setFilter(name, value) {
    if (name === "search") {
      setFilters((prev) => ({ ...prev, search: value }));
    } else {
      startFilterTransition(() => setFilters((prev) => ({ ...prev, [name]: value })));
    }
  }

  function resetAll() {
    setFilters(emptyFilters);
    setHiddenIds([]);
    setOrder(null);
  }

  // Hide only removes the post from this user's list; Firestore is untouched.
  function hidePost(id) {
    setHiddenIds((prev) => [...prev, id]);
  }

  // ----- Drag and drop re-ordering (native HTML5 drag events) -----
  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) return;
    const ids = (order || optimisticPosts.map((p) => p.id)).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setOrder(ids);
    setDragId(null);
  }

  const closeModal = useCallback(() => setOpenId(null), []);

  return (
    <main className="browse">
      <div className="post__bar">Browse Posts</div>

      <p className="browse__plan">
        {user ? (
          <>
            Signed in as <strong>{user.firstName}</strong> —{" "}
            <span className={`badge ${viewerPlan === "paid" ? "badge--paid" : "badge--free"}`}>
              {subscription === "trial" ? "Premium trial" : viewerPlan === "paid" ? "Premium plan" : "Free plan"}
            </span>
          </>
        ) : (
          <>
            Browsing as a visitor — <Link to="/login">log in</Link> to see more.
          </>
        )}
        {viewerPlan !== "paid" && (
          <>
            {" "}
            <Link to="/pricing">Upgrade or start a free trial</Link> to unlock Premium posts.
          </>
        )}
      </p>

      {/* ---------- Filters ---------- */}
      <section className="browse__filters" aria-label="Filter posts">
        <input
          type="search"
          placeholder="Search title or text…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          aria-label="Search posts"
        />
        <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)} aria-label="Post type">
          <option value="all">All types</option>
          <option value="article">Articles</option>
          <option value="question">Questions</option>
        </select>
        <select value={filters.plan} onChange={(e) => setFilter("plan", e.target.value)} aria-label="Post plan">
          <option value="all">Free &amp; Premium</option>
          <option value="free">Free</option>
          <option value="paid">Premium</option>
        </select>
        <select value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)} aria-label="Tag">
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="browse__date">
          From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="browse__date">
          To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        <button type="button" className="browse__reset" onClick={resetAll} disabled={!canReset}>
          Reset
        </button>
      </section>

      {filters.tag && (
        <p className="browse__active">
          Filtering by tag: <strong>{filters.tag}</strong>
          <button type="button" onClick={() => setFilter("tag", "")}>
            Clear tag filter
          </button>
        </p>
      )}

      <p className="browse__count">
        Showing {visible.length} of {total} posts
        {hiddenIds.length > 0 && ` · ${hiddenIds.length} hidden`}
        {visible.length > 1 && " · drag the handle to re-order"}
      </p>

      {/* ---------- List ---------- */}
      {status === "loading" && <p className="browse__message">Loading posts…</p>}
      {status === "error" && (
        <p className="browse__message browse__message--error" role="alert">
          Could not load posts. Make sure the backend is running and try again.
        </p>
      )}
      {status === "ready" && visible.length === 0 && !fetching && (
        <p className="browse__message">
          {total === 0 && !isFiltered ? "No posts yet — be the first to " : "No posts match your filters. "}
          {total === 0 && !isFiltered && <Link to="/post">create one</Link>}
        </p>
      )}

      <ul className={`browse__list ${isPending || fetching ? "is-busy" : ""}`}>
        {visible.map((p) => (
          <li
            key={p.id}
            className={`browse__card ${dragId === p.id ? "is-dragging" : ""}`}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(p.id)}
          >
            <span className="browse__grip" aria-hidden="true">
              ⋮⋮
            </span>

            <div className="browse__body">
              <div className="browse__meta">
                <span className={`badge badge--${p.type}`}>{p.type === "article" ? "Article" : "Question"}</span>
                <span className={`badge ${p.plan === "paid" ? "badge--paid" : "badge--free"}`}>
                  {p.plan === "paid" ? "Premium" : "Free"}
                </span>
                <span className="browse__author">
                  {p.authorName} · {formatDate(p.createdAt)}
                </span>
              </div>

              <h3 className="browse__title">
                <button type="button" onClick={() => setOpenId(p.id)}>
                  {p.title}
                </button>
              </h3>
              <p className="browse__preview">{previewOf(p)}</p>

              <div className="browse__foot">
                <div className="browse__tags">
                  {p.tags.map((t) => (
                    <button key={t} type="button" className="tag-chip" onClick={() => setFilter("tag", t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="browse__actions">
                  <button
                    type="button"
                    className={`like-btn ${p.likedByMe ? "like-btn--on" : ""}`}
                    onClick={() => handleLike(p)}
                    aria-pressed={p.likedByMe}
                  >
                    {p.likedByMe ? "Liked" : "Like"} · {p.likeCount}
                  </button>
                  <button type="button" onClick={() => setOpenId(p.id)}>
                    Read more
                  </button>
                  <button type="button" onClick={() => hidePost(p.id)} title="Hide from my list">
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Invisible marker: when it scrolls into view the next page loads */}
      {hasMore && status === "ready" && (
        <div ref={sentinelRef} className="browse__more">
          <button type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        </div>
      )}
      {status === "ready" && !hasMore && posts.length > 0 && (
        <p className="browse__end">You have reached the end — {total} post{total === 1 ? "" : "s"} in total.</p>
      )}

      {/* ---------- Expanded view (lazy-loaded) ---------- */}
      {openPost && (
        <Suspense
          fallback={
            <div className="browse__overlay">
              <p className="browse__loading">Opening post…</p>
            </div>
          }
        >
          <PostModal post={openPost} onClose={closeModal} onLike={handleLike} />
        </Suspense>
      )}
    </main>
  );
}

export default BrowsePosts;
