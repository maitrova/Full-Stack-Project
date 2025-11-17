import React from 'react'
import Header from '../components/Header'
import Hero from '../components/Hero'
import ProductCategories from '../components/productcategory'
import NewArrivalsWithImage from '../components/Newarrivals'
import CustomerReviews from '../components/customerreview'
import Footer from '../components/Footer'
import PromotionalProductsComponent from '../components/promotionalproducts'


const Homepage = () => {
  return (
    <>
    <Header/>
    <Hero/>
    <ProductCategories/>
    <PromotionalProductsComponent/>
    <NewArrivalsWithImage/>
    <CustomerReviews/>
    <Footer/>
    </>
  )
}

export default Homepage
