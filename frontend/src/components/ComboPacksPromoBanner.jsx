import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgePercent, PackageCheck, Sparkles, Truck } from "lucide-react";

const comboHighlights = [
  {
    title: "Starter Pack",
    subtitle: "Everyday essentials",
    label: "Styled set",
  },
  {
    title: "Family Pack",
    subtitle: "Coordinated looks",
    label: "Curated picks",
  },
  {
    title: "Bulk Pack",
    subtitle: "Ready for groups",
    label: "Easy selection",
  },
];

const ComboPacksPromoBanner = () => {
  return (
    <section className="bg-white">
      <div className="relative min-h-[430px] w-full overflow-hidden bg-white shadow-md sm:min-h-[520px] lg:min-h-[100svh]">
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
          src="/Hero/herovideo.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/75 via-white/45 to-white/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-white/55" />

        <div className="relative z-10">
          <div className="border-b border-white/35 bg-white/35 px-4 py-3 backdrop-blur-[2px] sm:px-7 lg:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <BadgePercent className="h-4 w-4 text-[#f2a900]" />
                Featured combo packs
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Curated sets
                </span>
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-sky-600" />
                  Easy ordering
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-h-[381px] items-stretch gap-0 sm:min-h-[471px] lg:min-h-[calc(100svh-49px)] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-14">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#f5d18a]/80 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a5a00] shadow-sm backdrop-blur-sm sm:mb-5 sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 text-[#ff9f00]" />
                Styled together
              </div>
              <h2 className="max-w-2xl text-3xl font-black leading-[1.05] text-gray-950 sm:text-5xl lg:text-6xl xl:text-7xl">
                Stylish combo packs for complete looks
              </h2>
              <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-gray-700 sm:mt-5 sm:text-lg sm:leading-7">
                Discover ready-made dress bundles picked for daily wear, family orders, and coordinated styling with simple checkout.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
                <Link
                  to="/combo-packs"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff9f00] px-5 text-sm font-bold text-gray-950 shadow-md transition hover:bg-[#f39a00] sm:h-12 sm:px-6"
                >
                  Shop combo packs
                  <ArrowRight size={16} />
                </Link>
                <span className="rounded-md border border-[#f5d18a]/80 bg-white/75 px-3 py-2 text-xs font-bold text-gray-900 shadow-sm backdrop-blur-sm sm:px-4 sm:py-3 sm:text-sm">
                  Curated styles
                </span>
              </div>

              <div className="mt-6 grid max-w-xl grid-cols-3 divide-x divide-gray-200/70 overflow-hidden rounded-md border border-white/60 bg-white/65 text-center shadow-sm backdrop-blur-sm sm:mt-8">
                <div className="px-3 py-3">
                  <p className="text-sm font-black text-gray-950">Matched</p>
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Styles</p>
                </div>
                <div className="px-3 py-3">
                  <p className="text-sm font-black text-gray-950">Ready</p>
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Bundles</p>
                </div>
                <div className="px-3 py-3">
                  <p className="text-sm font-black text-gray-950">Simple</p>
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Order</p>
                </div>
              </div>
            </div>

            <div className="hidden gap-4 bg-white/20 p-5 backdrop-blur-[1px] sm:p-7 lg:grid lg:content-center lg:grid-cols-3 lg:pr-10 xl:pr-14">
              {comboHighlights.map((item) => (
                <Link
                  key={item.title}
                  to="/combo-packs"
                  className="group flex min-h-[190px] w-[78vw] max-w-[280px] shrink-0 flex-col justify-between rounded-md border border-white/55 bg-white/65 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:border-[#ff9f00] hover:bg-white/85 hover:shadow-lg sm:w-[240px] lg:min-h-[240px] lg:w-auto lg:max-w-none"
                >
                  <div>
                    <div className="mb-4 flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-gray-50/75 to-[#fff7df]/70 lg:h-32">
                      <div className="flex items-end gap-2">
                        <span className="block h-14 w-10 rounded-sm bg-[#232f3e] shadow-sm" />
                        <span className="block h-20 w-12 rounded-sm bg-[#ff9f00] shadow-sm" />
                        <span className="block h-12 w-9 rounded-sm bg-[#2874f0] shadow-sm" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-gray-950">{item.title}</h3>
                    <p className="mt-1 text-sm font-medium text-gray-500">{item.subtitle}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="rounded-sm bg-[#232f3e] px-2 py-1 text-[11px] font-bold uppercase text-white">
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:text-[#ff9f00]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComboPacksPromoBanner;
