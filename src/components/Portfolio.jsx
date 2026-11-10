import ProjectCard from "./ProjectCard";

// Portfolio is a PARENT component — it maps over the projects array
// (from src/data/content.js) and renders a ProjectCard child for each one.
function Portfolio({ projects }) {
  return (
    <section id="work">
      <h2 style={{ textAlign: "center" }}>Things I've built</h2>

      <div className="portfolio-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            image={project.image}
            title={project.title}
            description={project.description}
            link={project.link}
          />
        ))}
      </div>
    </section>
  );
}

export default Portfolio;
