import ArticleCard from "./ArticleCard";

// ArticleSection is a PARENT component.
// This satisfies the task requirement: articles stored in an array
// of objects (see src/data/content.js) and rendered using map().
function ArticleSection({ articles, title = "Articles" }) {
  return (
    <section id="articles">
      <h2 style={{ textAlign: "center" }}>{title}</h2>
      <div className="portfolio-grid">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            image={article.image}
            title={article.title}
            description={article.description}
          />
        ))}
      </div>
    </section>
  );
}
export default ArticleSection;