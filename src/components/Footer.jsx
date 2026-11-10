import FooterColumn from "./FooterColumn";

// Footer is a PARENT component per the P3 design criteria (multi-column footer).
function Footer({ email }) {
  const columns = [
    { heading: "Explore", links: ["Home", "Work", "Articles"] },
    { heading: "Support", links: ["FAQs", "Help", "Contact Us"] },
    { heading: "Stay Connected", links: ["Newsletter", "GitHub", "LinkedIn"] },
  ];

  return (
    <footer id="contact">
      <h2>Let's build something.</h2>
      <p>Open to internships, collaborations, and interesting problems.</p>
      <a href={`mailto:${email}`}>{email}</a>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "40px",
          flexWrap: "wrap",
          marginTop: "32px",
          textAlign: "left",
        }}
      >
        {columns.map((column) => (
          <FooterColumn key={column.heading} heading={column.heading} links={column.links} />
        ))}
      </div>
    </footer>
  );
}

export default Footer;
