import React from 'react'
// import Header from '../components/Header'
import Hero from '../components/Hero'

import Footer from '../components/Footer'

// import HomepageFeatured from '../components/Newarrivals'
import Dropproduct from '../components/DropproductUserView'
import NewArrivals from '../components/Newarrivalss'
import BestSellers from '../components/Bestsellers'
import CategoryTilesHorizontal from '../components/Homepagecategotylist'
import ProductCategoriesHorizontal from '../components/homepagecustomizationcategorieslist'


const Homepage = () => {
  return (
    <>
    {/* <Header/> */}
    <Hero/>
    <Dropproduct/>
     <NewArrivals/>
    <BestSellers/>
    <ProductCategoriesHorizontal/>
    <CategoryTilesHorizontal/>
    <Footer/>
    </>
  )
}

export default Homepage
