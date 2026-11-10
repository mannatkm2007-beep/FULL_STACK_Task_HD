// Banner is a child of App.
// bannerImg is imported so Vite bundles it correctly (see note in README below).
import banner from "../assets/banner.png";
function Banner({ bannerImg, name }) {
  return (
    <div id="top" className="banner">
      <img src={banner} alt="Workspace banner" />
      <div className="greeting">Hey, I'm {name}</div>
    </div>
  );
}

export default Banner;
