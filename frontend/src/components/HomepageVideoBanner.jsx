const HomepageVideoBanner = () => (
  <section className="relative w-full overflow-hidden bg-slate-950" aria-label="Maitrova collection video">
    <video
      className="block h-auto w-full object-contain"
      src="/Hero/herovideo.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />
  </section>
);

export default HomepageVideoBanner;
