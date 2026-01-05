import React from 'react'
// import Header from '../components/Header'
import Hero from '../components/Hero'

import Footer from '../components/Footer'
import PromotionalProductsComponent from '../components/promotionalproducts'
import HomepageFeatured from '../components/Newarrivals'


const Homepage = () => {
  return (
    <>
    {/* <Header/> */}
    <Hero/>
    <HomepageFeatured/>
    <PromotionalProductsComponent/>
    
    <Footer/>
    </>
  )
}

export default Homepage
