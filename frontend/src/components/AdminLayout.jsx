// components/Layout/AdminLayout.jsx
import React from 'react';
import Sidebar from './Sidebar.jsx';

const AdminLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content - Adjusted for sidebar width */}
        <main className="flex-1 md:ml-64 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;