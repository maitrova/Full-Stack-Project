import React from 'react'
import HomeHero from '../components/HomeHero.jsx'
import Hero from '../components/Hero'

import Dropproduct from '../components/DropproductUserView'
import NewArrivals from '../components/Newarrivalss'
import BestSellers from '../components/Bestsellers'
import CategoryTilesHorizontal from '../components/Homepagecategotylist'
import ProductCategoriesHorizontal from '../components/homepagecustomizationcategorieslist'
import HomeBlogsSection from '../components/HomeBlogsSection.jsx'
import ComboPacksPromoBanner from '../components/ComboPacksPromoBanner.jsx'
import MakeItYoursBanner from '../components/home/MakeItYoursBanner.jsx'
import useHomepageBanners from '../hooks/useHomepageBanners.js'

// Section order follows the approved Sand reference:
// hero → categories → make it yours → better together → new arrivals,
// then best sellers, the live customizer and the remaining shelves.
const Homepage = () => {
  // Photos uploaded in admin → Homepage → Homepage banners (optional).
  const banners = useHomepageBanners()

  return (
    <div className="bg-mt-bg pb-6 font-brand text-mt-text">
      <HomeHero image={banners.hero.image} imageAlt={banners.hero.alt || undefined} />
      <CategoryTilesHorizontal />
      <MakeItYoursBanner image={banners.makeItYours.image} imageAlt={banners.makeItYours.alt || undefined} />
      <ComboPacksPromoBanner image={banners.betterTogether.image} imageAlt={banners.betterTogether.alt || undefined} />
      <NewArrivals />
      <BestSellers />
      <Hero />
      <Dropproduct />
      <ProductCategoriesHorizontal />
      <HomeBlogsSection />
    </div>
  )
}

export default Homepage
