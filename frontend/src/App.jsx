// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import ProductList from "./pages/ProductList.jsx";
import Homepage from "./pages/Homepage.jsx";
import AdminDesignsPage from "./pages/AdminDesignsPage.jsx";
import DesignerPage from "./components/productcustomization.jsx";
import LoginPage from "./pages/login.jsx";
import SignupPage from "./pages/signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Usersaveddesigns from "./components/usersavedesign.jsx";
import CataloguePage from "./pages/CataloguePage.jsx";
import CatalogueDetailPage from "./pages/CatalogueDetailPage.jsx";
import ReadymadeProductsManager from "./components/productmanager.jsx";
import ReadymadeProductList from "./components/ReadymadeProductList.jsx";
import CartPage from "./pages/CartPage.jsx";
import UnifiedDashboard from "./pages/unifieddashboard.jsx";
import Designdetailspage from "./components/designsdetailspage.jsx";

// Import separate detail pages for readymade products and designs
import ReadymadeProductDetailPage from "./components/readymadeproductdetailspage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import DesignUploadsManager from "./components/admindesignuploads.jsx";
import HomepageAdmin from "./pages/setHomepage.jsx";
import DropproductAdmin from "./components/dropproducts.jsx";
import DropProductDetailsPage from "./components/Dropproductsdetailpage.jsx";
import CustomProductsHub from "./components/CustomProductsHub.jsx";
import AllProductsHub from "./components/AllproductsHub.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ProductPricingManager from "./pages/productpricingmanager.jsx";
import AdminDashboards from "./components/admin/AdminDashboard.jsx";
import SubCategoryTilesPage from "./pages/SubCategoryTilesPage.jsx";
import CheckoutAddresses from "./components/CheckoutAddresses.jsx";
import CheckoutPage from "./components/testcheckout.jsx";
import UserOrders from "./components/userorders.jsx";
import AdminOrders from "./components/admin/ordersmanagement.jsx";
import ProductSearch from "./components/searchproductdetail.jsx";
import AdminOrderSearch from "./components/admin/adminsearchpage.jsx";
import PublishDesignModal from "./components/PublishDesignModal.jsx";
import CompanyDocumentManager from "./components/admin/CompanyDocumentManager.jsx";
import Shipping from "./companypdfs/Shipping.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
// You'll need to create this

// Layout component with header for all pages except auth
const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>{children}</main>
    </div>
  );
};

// Layout without header for auth pages
const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {children}
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Auth pages without header */}
        <Route path="/login" element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        } />
        
        <Route path="/register" element={
          <AuthLayout>
            <SignupPage />
          </AuthLayout>
        } />

        {/* All other pages with header */}
        <Route path="/" element={
          <MainLayout>
            <Homepage />
          </MainLayout>
        } />

        <Route path="/products" element={
          <MainLayout>
            <ProductList />
          </MainLayout>
        } />

        <Route path="/dropproducts/:id" element={
          <MainLayout>
            <DropProductDetailsPage />
          </MainLayout>
        } />

        <Route path="/profile" element={
          <MainLayout>
            <ProfilePage />
          </MainLayout>
        } />

        <Route path="/products/:slug/customize" element={
          <MainLayout>
            <ProtectedRoute>
              <DesignerPage />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="/adminpage" element={
          <MainLayout>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </MainLayout>
        } />

         <Route path="/adminpage/company-documents" element={
          <MainLayout>
           
              <CompanyDocumentManager />
            
          </MainLayout>
        } />


        <Route path="/publish-design" element={
          <MainLayout>
        
              <PublishDesignModal />
            
          </MainLayout>
        } />

        <Route path="/searchpage" element={
          <MainLayout>
            <ProtectedRoute>
              <AdminOrderSearch />
            </ProtectedRoute>
          </MainLayout>
        } />


        <Route path="/ProductSearch" element={
          <MainLayout>
          
              <ProductSearch />
  
          </MainLayout>
        } />


        <Route path="/adminpagehome" element={
          <MainLayout>
            <ProtectedRoute>
              <HomepageAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />
         <Route path="/customproducts" element={
          <MainLayout>
            <CustomProductsHub/>
          </MainLayout>
        } />

        <Route path="/Allproducts" element={
          <MainLayout>
            <AllProductsHub/>
          </MainLayout>
        } />


        <Route path="/subcategory" element={
          <MainLayout>
            <SubCategoryTilesPage/>
          </MainLayout>
        } />



        <Route path="/admindashboard" element={
          <MainLayout>
            <AdminDashboards/>
          </MainLayout>
        } />


        <Route path="/adminpage/design/uploads" element={
          <MainLayout>
            <ProtectedRoute>
              <DesignUploadsManager />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="/adminpage/drop-products" element={
          <MainLayout>
            <ProtectedRoute>
              <DropproductAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />

        

        <Route path="/usersaved_designs" element={
          <MainLayout>
            <Usersaveddesigns />
          </MainLayout>
        } />

        <Route path="/dashboard" element={
          <MainLayout>
            <UnifiedDashboard />
          </MainLayout>
        } />

        <Route path="/admin/designs" element={
          <MainLayout>
            <AdminDesignsPage />
          </MainLayout>
        } />

        <Route path="/orders" element={
          <MainLayout>
            <UserOrders />
          </MainLayout>
        } />

         <Route path="/managementorders" element={
          <MainLayout>
            <AdminOrders />
          </MainLayout>
        } />

         <Route path="/checkout" element={
          <MainLayout>
            <CheckoutAddresses />
          </MainLayout>
        } />

        <Route path="/checkoutpage" element={
          <MainLayout>
            <CheckoutPage />
          </MainLayout>
        } />

        <Route path="/catalogue" element={
          <MainLayout>
            <CataloguePage />
          </MainLayout>
        } />

        <Route path="/catalogue/:id" element={
          <MainLayout>
            <CatalogueDetailPage />
          </MainLayout>
        } />

        <Route path="/productmanager" element={
          <MainLayout>
            <ReadymadeProductsManager />
          </MainLayout>
        } />

        <Route path="/readymade/products" element={
          <MainLayout>
            <ReadymadeProductList />
          </MainLayout>
        } />

        {/* Readymade Product Details */}
        <Route path="/readymade/:id" element={
          <MainLayout>
            <ReadymadeProductDetailPage />
          </MainLayout>
        } />

        <Route path="/products/:id" element={
          <MainLayout>
            <ReadymadeProductDetailPage />
          </MainLayout>
        } />

        

        {/* Design Details */}
        <Route path="/designs/:id" element={
          <MainLayout>
            <Designdetailspage />
          </MainLayout>
        } />


          <Route path="/:name" element={
          <MainLayout>
            <Shipping />
          </MainLayout>
        } />


        <Route path="/price" element={
          <MainLayout>
            <ProductPricingManager />
          </MainLayout>
        } />

        {/* User Saved Design Details */}
        <Route path="/usersaveddesigns/:id" element={
          <MainLayout>
            <Designdetailspage />
          </MainLayout>
        } />

        {/* Cart Page */}
        <Route path="/cart" element={
          <MainLayout>
            <CartPage />
          </MainLayout>
        } />

        {/* Fallback 404 with header */}
        <Route path="*" element={
          <MainLayout>
            <div className="flex h-screen items-center justify-center bg-neutral-100">
              <div className="rounded-md bg-white px-8 py-6 shadow-lg text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">404</h1>
                <p className="text-gray-600 mb-4">Page not found</p>
                <a 
                  href="/" 
                  className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Go Home
                </a>
              </div>
            </div>
          </MainLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
