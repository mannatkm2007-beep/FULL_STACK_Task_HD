import photo from "../assets/profile.jpg";
// Profile is a child of App. Skills are rendered using map().

function Profile({ name, course, bio, skills, github, linkedin }) {
  return (
    <section id="about">
      <div className="card profile-card">
        <img src={photo} alt={name} />

        <div>
          <h1>{name}</h1>
          <p><strong>{course}</strong></p>
          <p>{bio}</p>

          <ul className="skills">
            {skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>

          <a href={github} target="_blank" rel="noopener noreferrer">GitHub</a>{" "}
          <a href={linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </div>
    </section>
  );
}

export default Profile;
