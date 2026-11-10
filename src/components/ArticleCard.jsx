// ArticleCard is a CHILD of ArticleSection.
function ArticleCard({ image, title, description }) {
  return (
    <div className="project-card">
      <img src={image} alt={title} />
      <div className="body">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default ArticleCard;
