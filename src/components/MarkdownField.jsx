import { useState } from "react";
import ReactMarkdown from "react-markdown";

// Textarea with Write / Preview tabs. Preview renders Markdown (React-Markdown).
function MarkdownField({ id, label, value, onChange, maxLength, rows, error, placeholder }) {
  const [tab, setTab] = useState("write");

  return (
    <div className="md">
      <div className="md__head">
        <label htmlFor={id}>{label}</label>
        <div className="md__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            className={tab === "write" ? "is-active" : ""}
            onClick={() => setTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={tab === "preview" ? "is-active" : ""}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          id={id}
          className={`post__textarea ${error ? "post__input--error" : ""}`}
          rows={rows}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder || "Markdown is supported, e.g. **bold**, `code`, - lists"}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="md__preview">
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="md__empty">Nothing to preview yet.</p>
          )}
        </div>
      )}
      <div className="post__counter">{value.length}/{maxLength}</div>
      {error && <p className="post__error" role="alert">{error}</p>}
    </div>
  );
}

export default MarkdownField;
