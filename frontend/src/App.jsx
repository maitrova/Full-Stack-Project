import React from 'react'
import Homepage from './pages/Homepage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TShirtRecolor from './components/TShirtRecolor';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
const App = () => {
  return (
    <>
     <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/recolor" element={<TShirtRecolor />} />
        <Route path='/login' element={<LoginPage />} />
        <Route path="/register" element={<SignupPage/>} />
      </Routes>
     </Router>
      
    </>
  )
}

export default App
