import React from 'react'
import Homepage from './pages/Homepage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TShirtRecolor from './components/TShirtRecolor';
const App = () => {
  return (
    <>
     <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/recolor" element={<TShirtRecolor />} />
      </Routes>
     </Router>
      
    </>
  )
}

export default App
