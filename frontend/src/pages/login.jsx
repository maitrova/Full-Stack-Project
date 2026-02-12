import React, { useState, useEffect } from 'react';
import { FiLock, FiLogIn, FiPhone } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, googleLogin } from '../redux/slices/Userslice.js';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userInfo, status, error } = useSelector((state) => state.user);

  // ✅ Redirect after ANY login (normal or Google)
  useEffect(() => {
    if (userInfo) {
      navigate('/');
    }
  }, [userInfo, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">

      {/* Image Section */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-12">
        <div className="text-center">
          <img
            src="https://i.etsystatic.com/15551585/r/il/0f7dd9/3790703050/il_fullxfull.3790703050_fohk.jpg"
            alt="Login Illustration"
            className="w-full max-w-lg mx-auto object-contain rounded-lg shadow-xl mb-8"
          />
          <h2 className="text-3xl font-bold mb-4">Welcome Back</h2>
          <p className="text-xl opacity-90">We're glad to see you again</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full md:w-1/2 lg:w-3/5 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Login</h1>
            <p className="text-gray-600">Sign in to access your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiPhone className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter phone"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Signing in...' : 'Login'}
            </button>

          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-grow h-px bg-gray-300"></div>
            <span className="mx-4 text-gray-500 text-sm">OR</span>
            <div className="flex-grow h-px bg-gray-300"></div>
          </div>

          {/* Google Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(res) => {
                dispatch(googleLogin(res.credential));
              }}
              onError={() => {
                console.log("Google Login Failed");
              }}
            />
          </div>

          {/* Signup Link */}
          <div className="text-center text-sm text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-purple-600 font-medium">
              Sign up
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
