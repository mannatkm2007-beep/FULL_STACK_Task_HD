// Gallery is a child of App. Image list is built with map().
function Gallery() {
  const imageIds = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <section>
      <h2 style={{ textAlign: "center" }}>Snapshots</h2>

      <div className="gallery-grid">
        {imageIds.map((id) => (
          <img
            key={id}
            src={`https://picsum.photos/seed/gallery-${id}/400/400`}
            alt={`Gallery image ${id}`}
          />
        ))}
      </div>
    </section>
  );
}

export default Gallery;
