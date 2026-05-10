import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Hero = () => {
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


