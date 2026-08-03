import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const ComboPacksPromoBanner = () => {
  return (
    <section className="bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div
        className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-[#ead8c9] bg-[#f8eadf] bg-cover bg-center shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(248,234,223,0.96) 0%, rgba(248,234,223,0.9) 38%, rgba(248,234,223,0.35) 68%, rgba(248,234,223,0.05) 100%), url('https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80')",
        }}
      >
        <div className="relative min-h-[300px] px-5 py-7 sm:px-8 lg:min-h-[340px]">
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[#c3a384]/80" />

          <div className="relative z-10 grid min-h-[245px] items-center lg:grid-cols-[minmax(360px,0.78fr)_minmax(320px,1fr)]">
            <div className="max-w-xl text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8a3f18]">
                Combo Offer
              </p>
              <h2 className="mt-2 text-5xl font-black leading-[0.95] text-[#8b2f0c] sm:text-6xl">
                Buy More
                <span className="block text-[#4fb51e]">Save More</span>
              </h2>
              <p className="mt-3 text-2xl font-semibold text-[#6f3318]">
                Premium dress combos for better value
              </p>
              <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#6f4b38]">
                Discover ready-made bundle offers with professional styles picked together for one simple purchase.
              </p>

              <Link
                to="/combo-packs"
                className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#59c617] px-7 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#46aa0f]"
              >
                Shop Now
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComboPacksPromoBanner;
