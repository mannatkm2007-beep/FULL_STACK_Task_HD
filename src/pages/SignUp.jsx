import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { API_URL } from "../context/AuthContext";

// Zod schema = data validation rules for the sign-up form
const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    // 1. Validate the input before doing anything else
    const result = signUpSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      // 2. Send the details to the backend. It validates the data, checks the
      //    email isn't taken, hashes the password and saves the user in Firestore.
      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message || "Something went wrong. Please try again.");
        return;
      }

      // 3. Redirect to the login page
      navigate("/login");
    } catch (err) {
      console.error("Sign-up error:", err);
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth__box auth__box--wide">
        <h2 className="auth__title">Create a DEV@Deakin Account</h2>

        <form onSubmit={handleSubmit} className="auth__grid" noValidate>
          <label>Name*</label>
          <div>
            <div className="auth__name-row">
              <input name="firstName" placeholder="First name" value={form.firstName} onChange={handleChange} />
              <input name="lastName" placeholder="Last name" value={form.lastName} onChange={handleChange} />
            </div>
            {(errors.firstName || errors.lastName) && (
              <p className="auth__error">{errors.firstName || errors.lastName}</p>
            )}
          </div>

          <label>Email*</label>
          <div>
            <input name="email" type="email" value={form.email} onChange={handleChange} />
            {errors.email && <p className="auth__error">{errors.email}</p>}
          </div>

          <label>Password*</label>
          <div>
            <input name="password" type="password" value={form.password} onChange={handleChange} />
            {errors.password && <p className="auth__error">{errors.password}</p>}
          </div>

          <label>Confirm password*</label>
          <div>
            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} />
            {errors.confirmPassword && <p className="auth__error">{errors.confirmPassword}</p>}
          </div>

          <span />
          <div>
            {formError && <p className="auth__error">{formError}</p>}
            <button type="submit" className="auth__submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default SignUp;