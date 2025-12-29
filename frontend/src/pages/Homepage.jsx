import React from 'react'
// import Header from '../components/Header'
import Hero from '../components/Hero'
import NewArrivalsWithImage from '../components/Newarrivals'
import Footer from '../components/Footer'
import PromotionalProductsComponent from '../components/promotionalproducts'

const Homepage = () => {
  return (
    <>
    {/* <Header/> */}
    <Hero/>
    <NewArrivalsWithImage/>
    <PromotionalProductsComponent/>
    
    <Footer/>
    </>
  )
}

export default Homepage
