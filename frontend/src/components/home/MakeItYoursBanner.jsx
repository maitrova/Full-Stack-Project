import { Button, Swatch } from "../ui/index.js";
import HomeBanner from "./HomeBanner.jsx";

const COLOURS = [
  { value: "#ffffff", label: "White" },
  { value: "#141414", label: "Black" },
  { value: "#1f3a2e", label: "Forest green" },
  { value: "#8b4f2c", label: "Brown" },
];

/** "Make it yours" promo card linking to the customizer. */
const MakeItYoursBanner = ({ image, imageAlt = "Custom printed hoodie" }) => (
  <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pt-5">
    <HomeBanner
      title="Make it yours"
      text="Choose your design, colour and create a piece that’s uniquely you."
      image={image}
      imageAlt={imageAlt}
    >
      <div className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4">
        <Swatch colors={COLOURS} size="sm" label="Available colours" className="gap-1.5 sm:gap-2" />
        <Button to="/customproducts" arrow className="h-8 px-3 text-[11px] sm:h-11 sm:px-5 sm:text-sm">
          Customize now
        </Button>
      </div>
    </HomeBanner>
  </section>
);

export default MakeItYoursBanner;
