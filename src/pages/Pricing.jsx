import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Crown } from "lucide-react";
import Swal from "sweetalert2";
import { z } from "zod";
import { useAuth, API_URL } from "../context/AuthContext";
import { daysLeft } from "../utils/time";

// Features shown in the comparison table (demo only - not actually enforced)
const features = [
  { name: "Read free community posts", free: true, paid: true },
  { name: "Access premium posts by top authors", free: false, paid: true },
  { name: "Posts allowed per month", free: "5 posts", paid: "Unlimited" },
  { name: "Image upload size limit", free: "2 MB", paid: "25 MB" },
  { name: "Markdown + code highlighting", free: true, paid: true },
  { name: "Featured post placement", free: false, paid: true },
  { name: "Ad-free experience", free: false, paid: true },
  { name: "Priority support", free: false, paid: true },
];

// Zod = validation rules for the payment form
const paymentSchema = z.object({
  cardName: z.string().trim().min(2, "Name on card is required"),
  cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiry must be in MM/YY format")
    .refine((value) => {
      const [mm, yy] = value.split("/").map(Number);
      const now = new Date();
      const year = now.getFullYear() % 100;
      return yy > year || (yy === year && mm >= now.getMonth() + 1);
    }, "This card has expired"),
  cvc: z.string().regex(/^\d{3,4}$/, "CVC must be 3 or 4 digits"),
});

function Cell({ value }) {
  if (value === true) return <Check size={18} className="pricing__yes" />;
  if (value === false) return <X size={18} className="pricing__no" />;
  return <span>{value}</span>;
}

function Pricing() {
  const { user, token, setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cardName: "", cardNumber: "", expiry: "", cvc: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // "paid" means they really bought Premium (a trial user can still upgrade)
  const isPaid = user?.subscription === "paid";
  const onTrial = user?.subscription === "trial";
  const trialAvailable = !user || (user.subscription === "free" && !user.trialUsed);
  const [trialLoading, setTrialLoading] = useState(false);

  // Starts the 7-day free trial (the backend allows it once per account)
  async function startTrial() {
    if (!user) {
      Swal.fire({
        icon: "info",
        title: "Please log in",
        text: "You need to be logged in to start your free trial.",
        confirmButtonText: "Go to login",
      }).then((result) => {
        if (result.isConfirmed) navigate("/login");
      });
      return;
    }

    setTrialLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/trial/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        Swal.fire({ icon: "error", title: "Trial not started", text: data.message || "Please try again." });
        return;
      }

      setUser(data.user);
      Swal.fire({
        icon: "success",
        title: "Your free trial has started!",
        text: "You can now read all Premium posts for 7 days.",
      });
    } catch {
      Swal.fire({ icon: "error", title: "Something went wrong", text: "Could not reach the server." });
    } finally {
      setTrialLoading(false);
    }
  }

  function openModal() {
    // Only logged-in users can upgrade
    if (!user) {
      Swal.fire({
        icon: "info",
        title: "Please log in",
        text: "You need to be logged in to upgrade your plan.",
        confirmButtonText: "Go to login",
      }).then((result) => {
        if (result.isConfirmed) navigate("/login");
      });
      return;
    }
    // Paid users cannot upgrade again
    if (isPaid) {
      Swal.fire({ icon: "info", title: "You're already Premium", text: "You are already on the Paid plan." });
      return;
    }
    setErrors({});
    setFormError("");
    setOpen(true);
  }

  function handleChange(event) {
    let { name, value } = event.target;

    if (name === "cardNumber") {
      // keep digits only, show in groups of 4
      const digits = value.replace(/\D/g, "").slice(0, 16);
      value = digits.replace(/(.{4})/g, "$1 ").trim();
    }
    if (name === "expiry") {
      const digits = value.replace(/\D/g, "").slice(0, 4);
      value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    }
    if (name === "cvc") value = value.replace(/\D/g, "").slice(0, 4);

    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const payload = { ...form, cardNumber: form.cardNumber.replace(/\s/g, "") };
    const result = paymentSchema.safeParse(payload);

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
      const res = await fetch(`${API_URL}/api/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message || "Payment failed. Please try again.");
        return;
      }

      setUser(data.user);
      setOpen(false);
      setForm({ cardName: "", cardNumber: "", expiry: "", cvc: "" });
      Swal.fire({
        icon: "success",
        title: "Welcome to Premium!",
        text: "Your plan has been upgraded successfully.",
      });
    } catch (err) {
      console.error("Upgrade error:", err);
      setFormError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pricing">
      <h1 className="pricing__title">Choose your plan</h1>
      <p className="pricing__sub">Start for free, upgrade whenever you want more from DEV@Deakin.</p>

      {onTrial && (
        <div className="pricing__trial">
          <div>
            <strong>You are on a free Premium trial</strong>
            <p>{daysLeft(user.trialEndsAt)} day(s) left. Upgrade any time to keep Premium after the trial.</p>
          </div>
        </div>
      )}
      {trialAvailable && (
        <div className="pricing__trial">
          <div>
            <strong>Try Premium free for 7 days</strong>
            <p>No card needed. You can read every Premium post during the trial, once per account.</p>
          </div>
          <button type="button" className="pricing__btn" onClick={startTrial} disabled={trialLoading}>
            {trialLoading ? "Starting…" : user ? "Start free trial" : "Log in to start trial"}
          </button>
        </div>
      )}
      {user && !trialAvailable && !onTrial && !isPaid && (
        <div className="pricing__trial">
          <div>
            <strong>Your free trial has ended</strong>
            <p>Upgrade to Premium to get access to all Premium posts again.</p>
          </div>
        </div>
      )}

      <div className="pricing__cards">
        {/* Free plan */}
        <section className={`pricing__card ${user && !isPaid && !onTrial ? "pricing__card--current" : ""}`}>
          <h2>Free</h2>
          <p className="pricing__price">$0<span>/month</span></p>
          <ul>
            {features.map((f) => (
              <li key={f.name}>
                <Cell value={f.free} />
                <span>{f.name}{typeof f.free === "string" ? `: ${f.free}` : ""}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="pricing__btn pricing__btn--ghost" disabled>
            {user && !isPaid && !onTrial ? "Your current plan" : "Free forever"}
          </button>
        </section>

        {/* Paid plan */}
        <section className={`pricing__card pricing__card--premium ${isPaid ? "pricing__card--current" : ""}`}>
          <span className="pricing__ribbon"><Crown size={14} /> Most popular</span>
          <h2>Premium</h2>
          <p className="pricing__price">$9.99<span>/month</span></p>
          <ul>
            {features.map((f) => (
              <li key={f.name}>
                <Cell value={f.paid} />
                <span>{f.name}{typeof f.paid === "string" ? `: ${f.paid}` : ""}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="pricing__btn"
            onClick={openModal}
            disabled={isPaid}
          >
            {isPaid ? "You're on Premium" : user ? "Upgrade Plan" : "Log in to upgrade"}
          </button>
        </section>
      </div>

      {/* Payment modal */}
      {open && (
        <div className="modal" onClick={() => !loading && setOpen(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="modal__close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
            <h2>Upgrade to Premium</h2>
            <p className="modal__sub">$9.99/month. This is a demo - no real payment is taken.</p>

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="cardName">Name on card</label>
              <input id="cardName" name="cardName" value={form.cardName} onChange={handleChange} autoComplete="cc-name" />
              {errors.cardName && <p className="auth__error">{errors.cardName}</p>}

              <label htmlFor="cardNumber">Card number</label>
              <input id="cardNumber" name="cardNumber" inputMode="numeric" placeholder="1234 5678 9012 3456" value={form.cardNumber} onChange={handleChange} autoComplete="cc-number" />
              {errors.cardNumber && <p className="auth__error">{errors.cardNumber}</p>}

              <div className="modal__row">
                <div>
                  <label htmlFor="expiry">Expiry</label>
                  <input id="expiry" name="expiry" inputMode="numeric" placeholder="MM/YY" value={form.expiry} onChange={handleChange} autoComplete="cc-exp" />
                  {errors.expiry && <p className="auth__error">{errors.expiry}</p>}
                </div>
                <div>
                  <label htmlFor="cvc">CVC</label>
                  <input id="cvc" name="cvc" inputMode="numeric" placeholder="123" value={form.cvc} onChange={handleChange} autoComplete="cc-csc" />
                  {errors.cvc && <p className="auth__error">{errors.cvc}</p>}
                </div>
              </div>

              {formError && <p className="auth__error">{formError}</p>}

              <button type="submit" className="auth__submit" disabled={loading}>
                {loading ? "Processing..." : "Pay $9.99 & upgrade"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default Pricing;
