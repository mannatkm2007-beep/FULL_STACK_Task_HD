import { useState } from "react";

function SignUpBar() {

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(event) {

    event.preventDefault();

    console.log("First Name:", firstName);
    console.log("Last Name:", lastName);
    console.log("Email:", email);

    try {

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/signup`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            firstName: firstName,
            lastName: lastName,
            email: email
          })
        }
      );

      const result = await response.json();

      console.log("Server response:", result);

      if (response.status === 202) {

        alert(result.message);

        // Clear form
        setFirstName("");
        setLastName("");
        setEmail("");

      } else {

        alert(result.message);
      }

    } catch (error) {

      console.log(
        "Error submitting form:",
        error
      );

      alert(
        "Couldn't reach the Express server. " +
        "Make sure the backend is running."
      );
    }
  }

  return (
    <section id="signup">

      <div className="card signup-card">

        <h2>
          Join the DEV@Deakin mailing list
        </h2>

        <p>
          Get an email whenever a new project
          or update goes live.
        </p>

        <form onSubmit={handleSubmit}>

          <label htmlFor="firstName">
            First Name
          </label>

          <input
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) =>
              setFirstName(e.target.value)
            }
            placeholder="Enter your first name"
            required
          />

          <label htmlFor="lastName">
            Last Name
          </label>

          <input
            type="text"
            id="lastName"
            value={lastName}
            onChange={(e) =>
              setLastName(e.target.value)
            }
            placeholder="Enter your last name"
            required
          />

          <label htmlFor="email">
            Email
          </label>

          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter your email"
            required
          />

          <button type="submit">
            Sign Up
          </button>

        </form>

      </div>

    </section>
  );
}

export default SignUpBar;