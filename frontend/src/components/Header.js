import React from 'react';
import { FaTasks } from 'react-icons/fa';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <FaTasks className="logo-icon" />
          <h1>Task Manager Pro</h1>
        </div>
        <p className="tagline">Organize your life with style</p>
      </div>
      <div className="header-decoration"></div>
    </header>
  );
}

export default Header;
