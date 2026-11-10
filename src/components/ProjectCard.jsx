// ProjectCard is a CHILD of Portfolio.
function ProjectCard({ image, title, description, link }) {
  return (
    <div className="project-card">
      <img src={image} alt={title} />
      <div className="body">
        <h3>{title}</h3>
        <p>{description}</p>
        <a href={link} target="_blank" rel="noopener noreferrer">View on GitHub</a>
      </div>
    </div>
  );
}

export default ProjectCard;
