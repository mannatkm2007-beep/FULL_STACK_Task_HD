import { useState } from "react";

// Tag input: press Enter or comma to add a tag, click x to remove. Max 3 tags.
function TagInput({ tags, onChange, max = 3, error, placeholder }) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState("");

  function addTag() {
    const tag = text.trim().replace(/,$/, "").toLowerCase();
    if (!tag) return;
    if (!/^[a-z0-9#+.-]{1,20}$/.test(tag)) {
      setLocalError("Tags can be 1–20 characters: letters, numbers, # + . -");
      return;
    }
    if (tags.includes(tag)) {
      setLocalError("That tag is already added");
      return;
    }
    if (tags.length >= max) {
      setLocalError(`You can add up to ${max} tags`);
      return;
    }
    setLocalError("");
    onChange([...tags, tag]);
    setText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  const shown = localError || error;

  return (
    <div className="tags">
      <label htmlFor="tag-input">Tags</label>
      <div className={`tags__box ${shown ? "post__input--error" : ""}`}>
        {tags.map((t) => (
          <span className="tags__chip" key={t}>
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
            >
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          type="text"
          value={text}
          disabled={tags.length >= max}
          placeholder={tags.length ? "" : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setLocalError("");
          }}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
        />
      </div>
      <div className="post__counter">{tags.length}/{max} tags — press Enter to add</div>
      {shown && <p className="post__error" role="alert">{shown}</p>}
    </div>
  );
}

export default TagInput;
