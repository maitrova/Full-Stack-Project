import { useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const suggestedSearches = ["Oversized tees", "Hoodies", "Anime", "Couple tees"];

const Hero = () => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const submitSearch = (event) => {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) {
      navigate("/products");
      return;
    }

    const params = new URLSearchParams({ search: searchTerm });
    navigate(`/products?${params.toString()}`);
  };

  const applySuggestedSearch = (searchTerm) => {
    const params = new URLSearchParams({ search: searchTerm });
    navigate(`/products?${params.toString()}`);
  };

  return (
    <section className="relative w-full aspect-video overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/Hero/herovideo.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      
    </section>
  );
};

export default Hero;


