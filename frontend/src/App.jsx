// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
 // Changed from ./components/productcustomization.jsx
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect to products listing */}
        <Route path="/" element={<Homepage/>} />

        {/* Product grid (hoodie, sweatshirt, tees, etc.) */}
        <Route path="/products" element={<ProductList />} />

        {/* Customization page for a specific product */}
        {/* You can choose one of these routes, not both */}
        <Route path="/products/:slug/customize" element={<ProtectedRoute>
      <DesignerPage />
    </ProtectedRoute>} />
        {/* OR use this route: */}
        {/* <Route path="/designer/:slug" element={<DesignerPage />} /> */}
        <Route path="/usersaved_designs" element={<Usersaveddesigns/>} />
        <Route path="/admin/designs" element={<AdminDesignsPage />} />
        <Route path="/login" element={<LoginPage/>}></Route>
        <Route path="/register" element={<SignupPage/>}></Route>
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/catalogue/:id" element={<CatalogueDetailPage />} />
        {/* Fallback 404 */}
        <Route
          path="*"
          element={
            <div className="flex h-screen items-center justify-center bg-neutral-100">
              <div className="rounded-md bg-white px-4 py-3 shadow text-sm">
                404 – Page not found
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;