import React from 'react'
// import Header from '../components/Header'
import Hero from '../components/Hero'
import HomepageVideoBanner from '../components/HomepageVideoBanner'

// import HomepageFeatured from '../components/Newarrivals'
import Dropproduct from '../components/DropproductUserView'
import NewArrivals from '../components/Newarrivalss'
import BestSellers from '../components/Bestsellers'
import CategoryTilesHorizontal from '../components/Homepagecategotylist'
import ProductCategoriesHorizontal from '../components/homepagecustomizationcategorieslist'
import HomeBlogsSection from '../components/HomeBlogsSection.jsx'
import ComboPacksPromoBanner from '../components/ComboPacksPromoBanner.jsx'


const Homepage = () => {
  return (
    <>
    {/* <Header/> */}
    {/* <HomepageVideoBanner/> */}
    <ComboPacksPromoBanner/>
    <Hero/>
    
    <Dropproduct/>
    
    <NewArrivals/>
    <BestSellers/>
    <ProductCategoriesHorizontal/>
    <CategoryTilesHorizontal/>
    <HomeBlogsSection />
    </>
  )
}

export default Homepage
