import React, { useState, useEffect } from "react";
import { FiUser, FiPhone, FiMail, FiLock } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, googleLogin } from "../redux/slices/Userslice.js";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, Link } from "react-router-dom";

const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "user",
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userInfo, status, error } = useSelector((state) => state.user);

  // ✅ Redirect after ANY signup (normal or Google)
  useEffect(() => {
    if (userInfo) {
      navigate("/");
    }
  }, [userInfo, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(registerUser(formData));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">

      {/* Image Section */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-12">
        <div className="text-center">
          <img
            src="https://media.istockphoto.com/id/1161353090/photo/friends-embracing-and-having-fun-over-white-brick-wall.jpg?s=612x612&w=0&k=20&c=NP7MhQz_CLRP7-9tq2q0CD1IlmlvaqnKvzeUp1eQ0p8="
            alt="Signup"
            className="w-full max-w-lg mx-auto object-contain rounded-lg shadow-xl mb-8"
          />
          <h2 className="text-3xl font-bold mb-4">Create Your Account</h2>
          <p className="text-xl opacity-90">
            Unlock exclusive deals and personalized shopping
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full md:w-1/2 lg:w-3/5 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Create Account
            </h1>
            <p className="text-gray-600">
              Fill in your details to get started
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Phone Signup */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-violet-600"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-violet-600"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-violet-600"
                  placeholder="Enter email (optional)"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-violet-600"
                  placeholder="Create password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-gradient-to-r from-violet-700 to-violet-500 text-white py-3 rounded-lg"
            >
              {status === "loading" ? "Creating..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-grow h-px bg-gray-300" />
            <span className="mx-4 text-gray-500 text-sm">OR</span>
            <div className="flex-grow h-px bg-gray-300" />
          </div>

          {/* Google Signup */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={(res) => {
                dispatch(googleLogin(res.credential));
              }}
              onError={() => {
                console.log("Google Signup Failed");
              }}
            />
          </div>

          <div className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-violet-600 font-medium">
              Log in
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
