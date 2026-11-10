// FooterColumn is a CHILD of Footer.
function FooterColumn({ heading, links }) {
  return (
    <div>
      <h4>{heading}</h4>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {links.map((link) => (
          <li key={link} style={{ marginBottom: "6px" }}>
            <a href="#top">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FooterColumn;
