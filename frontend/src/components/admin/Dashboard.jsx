// components/admin/Dashboard.jsx
import React from 'react';
import { LayoutDashboard, TrendingUp, DollarSign, Package, Users } from 'lucide-react';

const Dashboard = () => {
  const dashboardStats = [
    { label: 'Total Products', value: '1,245', change: '+12%', color: 'blue', icon: <Package className="w-6 h-6" /> },
    { label: 'Designs', value: '89', change: '+8%', color: 'green', icon: <TrendingUp className="w-6 h-6" /> },
    { label: 'Best Sellers', value: '56', change: '+23%', color: 'purple', icon: <DollarSign className="w-6 h-6" /> },
    { label: 'Revenue', value: '$24,580', change: '+15%', color: 'orange', icon: <DollarSign className="w-6 h-6" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${
                stat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                stat.color === 'green' ? 'bg-green-100 text-green-600' :
                stat.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                {stat.icon}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                stat.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                stat.color === 'green' ? 'bg-green-100 text-green-800' :
                stat.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {stat.change}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    stat.color === 'blue' ? 'bg-blue-500' :
                    stat.color === 'green' ? 'bg-green-500' :
                    stat.color === 'purple' ? 'bg-purple-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: '75%' }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { icon: <Package className="w-5 h-5 text-blue-600" />, title: 'New product added', time: '2 hours ago' },
              { icon: <Users className="w-5 h-5 text-green-600" />, title: 'New user registered', time: '4 hours ago' },
              { icon: <DollarSign className="w-5 h-5 text-purple-600" />, title: 'Order completed', time: '1 day ago' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  {activity.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Low Stock Products', value: '12', color: 'red' },
              { label: 'Pending Orders', value: '8', color: 'yellow' },
              { label: "Today's Revenue", value: '$2,450', color: 'green' },
              { label: 'Active Users', value: '342', color: 'blue' },
            ].map((stat, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-600">{stat.label}</span>
                <span className={`font-bold ${
                  stat.color === 'red' ? 'text-red-600' :
                  stat.color === 'yellow' ? 'text-yellow-600' :
                  stat.color === 'green' ? 'text-green-600' :
                  'text-blue-600'
                }`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;