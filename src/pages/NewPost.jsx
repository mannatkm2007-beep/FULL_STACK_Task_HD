import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import Swal from "sweetalert2";
import MarkdownField from "../components/MarkdownField";
import TagInput from "../components/TagInput";
import { useAuth, API_URL } from "../context/AuthContext";

// ---------- Zod schemas (data validation) ----------
const tagsSchema = z
  .array(z.string())
  .min(1, "Please add at least 1 tag")
  .max(3, "You can add up to 3 tags");

const questionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Title must be at least 10 characters")
    .max(150, "Title must be 150 characters or fewer")
    .regex(
      /^(how|what|why|when|where|which|who|can|should|is|are|do|does)\b/i,
      "Start your question with how, what, why, etc."
    ),
  body: z
    .string()
    .trim()
    .min(20, "Please describe your problem in at least 20 characters")
    .max(5000, "Description must be 5000 characters or fewer"),
  tags: tagsSchema,
});

const articleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be 120 characters or fewer"),
  abstract: z
    .string()
    .trim()
    .min(20, "Abstract must be at least 20 characters")
    .max(300, "Abstract must be 300 characters or fewer"),
  body: z
    .string()
    .trim()
    .min(50, "Article text must be at least 50 characters")
    .max(10000, "Article text must be 10000 characters or fewer"),
  tags: tagsSchema,
});

const emptyQuestion = { title: "", body: "", tags: [] };
const emptyArticle = { title: "", abstract: "", body: "", tags: [] };
const DRAFT_KEY = "devdeakin_post_draft";

// Reads a saved draft (if any) so the user doesn't lose their work.
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch {
    return {};
  }
}

function NewPost() {
  const { user, token, loading } = useAuth();
  const [plan, setPlan] = useState("free"); // who can read this post: free | paid
  // Hooks: the post type drives conditional rendering.
  const draft = loadDraft();
  const [postType, setPostType] = useState(draft.postType || "question");
  const [question, setQuestion] = useState({ ...emptyQuestion, ...draft.question });
  const [article, setArticle] = useState({ ...emptyArticle, ...draft.article });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const isQuestion = postType === "question";
  const form = isQuestion ? question : article;
  const setForm = isQuestion ? setQuestion : setArticle;

  // Auto-save the draft shortly after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ postType, question, article })
        );
        setDraftSaved(true);
      } catch {
        /* storage unavailable - ignore */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [postType, question, article]);

  function handleTypeChange(event) {
    setPostType(event.target.value);
    setErrors({}); // errors belong to the other form
  }

  function updateField(name, value) {
    setDraftSaved(false);
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const schema = isQuestion ? questionSchema : articleSchema;
    const result = schema.safeParse(form);

    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      await Swal.fire({
        icon: "error",
        title: "Post not sent",
        text: "Please fix the highlighted fields and try again.",
        confirmButtonColor: "#2f6f62",
      });
      return;
    }

    // Posting needs a logged-in user (the backend checks this too)
    if (!user || !token) {
      await Swal.fire({
        icon: "warning",
        title: "Please log in",
        text: "You need to be logged in to submit a post.",
        confirmButtonColor: "#2f6f62",
      });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // The backend validates again and saves the post to Firestore
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...result.data, type: postType, plan }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Post not sent",
          text: data.message || "Your post could not be sent. Please try again.",
          confirmButtonColor: "#2f6f62",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Post sent!",
        text: `Your ${postType} "${result.data.title}" has been published.`,
        confirmButtonColor: "#2f6f62",
      });
      setForm(isQuestion ? emptyQuestion : emptyArticle);
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: "Could not reach the server. Please try again.",
        confirmButtonColor: "#2f6f62",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Clear this form?",
      showCancelButton: true,
      confirmButtonText: "Yes, clear it",
      confirmButtonColor: "#d65f4c",
    });
    if (isConfirmed) {
      setForm(isQuestion ? emptyQuestion : emptyArticle);
      setErrors({});
    }
  }

  const fieldClass = (name) => (errors[name] ? "post__input post__input--error" : "post__input");
  const fieldError = (name) =>
    errors[name] ? <p className="post__error" role="alert">{errors[name]}</p> : null;

  return (
    <main className="post">
      <div className="post__bar">New Post</div>

      {!loading && !user && (
        <p className="post__notice" role="alert">
          You need to <Link to="/login">log in</Link> before you can submit a post.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="post__type">
          <legend>Select Post Type:</legend>
          <label className="post__radio">
            <input
              type="radio"
              name="postType"
              value="question"
              checked={isQuestion}
              onChange={handleTypeChange}
            />
            Question
          </label>
          <label className="post__radio">
            <input
              type="radio"
              name="postType"
              value="article"
              checked={!isQuestion}
              onChange={handleTypeChange}
            />
            Article
          </label>
        </fieldset>

        <fieldset className="post__type">
          <legend>Post Plan:</legend>
          <label className="post__radio">
            <input
              type="radio"
              name="postPlan"
              value="free"
              checked={plan === "free"}
              onChange={(e) => setPlan(e.target.value)}
            />
            Free (everyone can read)
          </label>
          <label className="post__radio">
            <input
              type="radio"
              name="postPlan"
              value="paid"
              checked={plan === "paid"}
              onChange={(e) => setPlan(e.target.value)}
            />
            Premium (Paid members only)
          </label>
        </fieldset>

        <div className="post__bar">What do you want to ask or share</div>

        {/* ---------- Conditional rendering based on postType ---------- */}
        {isQuestion ? (
          <>
            <label htmlFor="q-title">Title</label>
            <input
              id="q-title"
              className={fieldClass("title")}
              type="text"
              placeholder="Start your question with how, what, why, etc."
              value={question.title}
              maxLength={150}
              onChange={(e) => updateField("title", e.target.value)}
            />
            {fieldError("title")}

            <MarkdownField
              id="q-body"
              label="Describe your problem"
              value={question.body}
              maxLength={5000}
              rows={12}
              error={errors.body}
              onChange={(v) => updateField("body", v)}
            />
          </>
        ) : (
          <>
            <label htmlFor="a-title">Title</label>
            <input
              id="a-title"
              className={fieldClass("title")}
              type="text"
              placeholder="Enter a descriptive title"
              value={article.title}
              maxLength={120}
              onChange={(e) => updateField("title", e.target.value)}
            />
            {fieldError("title")}

            <label htmlFor="a-abstract">Abstract</label>
            <textarea
              id="a-abstract"
              className={`post__textarea post__textarea--short ${errors.abstract ? "post__input--error" : ""}`}
              placeholder="Enter a 1 paragraph abstract"
              value={article.abstract}
              maxLength={300}
              rows={4}
              onChange={(e) => updateField("abstract", e.target.value)}
            />
            <div className="post__counter">{article.abstract.length}/300</div>
            {fieldError("abstract")}

            <MarkdownField
              id="a-body"
              label="Article Text"
              placeholder="Write your article here. Markdown is supported."
              value={article.body}
              maxLength={10000}
              rows={16}
              error={errors.body}
              onChange={(v) => updateField("body", v)}
            />
          </>
        )}

        <TagInput
          tags={form.tags}
          error={errors.tags}
          max={3}
          placeholder={
            isQuestion
              ? "Please add up to 3 tags to describe what your question is about e.g., Java"
              : "Please add up to 3 tags to describe what your article is about e.g., Java"
          }
          onChange={(tags) => updateField("tags", tags)}
        />

        <div className="post__actions">
          <span className="post__draft">{draftSaved ? "Draft saved" : ""}</span>
          <button type="button" className="post__clear" onClick={handleClear}>
            Clear
          </button>
          <button type="submit" className="post__submit" disabled={submitting}>
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default NewPost;
