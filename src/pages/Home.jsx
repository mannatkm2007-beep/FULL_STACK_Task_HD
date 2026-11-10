import Banner from "../components/Banner";
import Profile from "../components/Profile";
import Gallery from "../components/Gallery";
import SignUpBar from "../components/SignUpBar";
import ArticleSection from "../components/ArticleSection";
import { articles, tutorials } from "../data/content";

// Home holds the same sections that App used to render in P3.
function Home() {
  return (
    <>
      <Banner name="Harsimran" />

      <Profile
        name="Harsimran Kaur"
        course="Bachelor of Computer Science — Deakin University"
        bio="I'm a student developer sharpening my HTML, CSS, JavaScript and React skills through DEV@Deakin."
        skills={["HTML5", "CSS3", "JavaScript", "React", "Node.js", "Express"]}
        github="https://github.com/mannatkm2007-beep"
        linkedin="https://www.linkedin.com/in/harsimran-kaur-41494a37b/"
      />


      // ...inside your JSX:
<ArticleSection articles={articles} />
<ArticleSection articles={tutorials} title="Tutorials" />

      <Gallery />
      <SignUpBar />
    </>
  );
}

export default Home;