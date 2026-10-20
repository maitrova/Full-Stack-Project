import { Button } from "./ui/index.js";
import HomeBanner from "./home/HomeBanner.jsx";

const HomeHero = ({ image, imageAlt = "MAITROVA custom apparel" }) => (
  <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
    <HomeBanner
      as="h1"
      size="lg"
      title={
        <>
          Your style.
          <br />
          Your signature.
        </>
      }
      text="Premium tees, hoodies and sweatshirts — designed by you, printed by us."
      image={image}
      imageAlt={imageAlt}
    >
      <div className="flex flex-wrap gap-3 pt-1">
        <Button to="/customproducts" arrow className="h-9 px-3.5 text-xs sm:h-11 sm:px-5 sm:text-sm">
          Start customizing
        </Button>
        <Button to="/products" variant="banner" className="hidden h-11 sm:inline-flex">
          Shop products
        </Button>
      </div>
    </HomeBanner>
  </section>
);

export default HomeHero;
