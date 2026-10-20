import React, { useState, useEffect } from "react";
import { FiUser, FiPhone, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, googleLogin } from "../redux/slices/Userslice.js";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, useLocation, Link } from "react-router-dom";

const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { userInfo, status, error } = useSelector((state) => state.user);

  // ✅ Redirect after ANY signup (normal or Google)
  useEffect(() => {
    if (userInfo) {
      const fromState = location.state?.from;
      const redirectTo =
        typeof fromState === "string"
          ? fromState
          : fromState?.pathname
            ? `${fromState.pathname}${fromState.search || ""}${fromState.hash || ""}`
            : "/";
      navigate(redirectTo, { replace: true });
    }
  }, [userInfo, location.state, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "password" || name === "confirmPassword") {
      setPasswordError("");
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTermsChange = (e) => {
    setTermsAccepted(e.target.checked);
    if (e.target.checked) {
      setTermsError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setTermsError("Please accept the terms and conditions to continue");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    
    setTermsError("");
    setPasswordError("");
    dispatch(registerUser(formData));
  };

  return (
    <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)] flex flex-col md:flex-row">

      {/* Image Section */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-12">
        <div className="text-center">
          <img
            src="https://media.istockphoto.com/id/1161353090/photo/friends-embracing-and-having-fun-over-white-brick-wall.jpg?s=612x612&w=0&k=20&c=NP7MhQz_CLRP7-9tq2q0CD1IlmlvaqnKvzeUp1eQ0p8="
            alt="Signup"
            className="w-full max-w-lg mx-auto object-contain rounded-lg shadow-xl mb-8"
          />
          <h2 className="text-3xl font-normal mb-4">Create Your Account</h2>
          <p className="text-xl opacity-90">
            Unlock exclusive deals and personalized shopping
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full md:w-1/2 lg:w-3/5 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-normal text-mt-text mb-2">
              Create Account
            </h1>
            <p className="text-mt-muted">
              Fill in your details to get started
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-mt-danger/10 text-mt-danger rounded-lg">
              {error}
            </div>
          )}

          {termsError && (
            <div className="mb-4 p-3 bg-mt-danger/10 text-mt-danger rounded-lg">
              {termsError}
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-3 bg-mt-danger/10 text-mt-danger rounded-lg">
              {passwordError}
            </div>
          )}

          {/* Phone Signup */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-mt-muted mb-1">
                Full Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-3.5 text-mt-subtle" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-mt-text"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-mt-muted mb-1">
                Phone
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-3.5 text-mt-subtle" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-mt-text"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-mt-muted mb-1">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-3.5 text-mt-subtle" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-mt-text"
                  placeholder="Enter email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-mt-muted mb-1">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3.5 text-mt-subtle" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-mt-text"
                  placeholder="Create password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-mt-subtle hover:text-mt-text transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-mt-muted mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3.5 text-mt-subtle" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-mt-text"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-mt-subtle hover:text-mt-text transition"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={handleTermsChange}
                required
                className="mt-1 h-4 w-4 text-mt-text focus:ring-mt-text border-mt-line-strong rounded"
              />
              <label htmlFor="terms" className="text-sm text-mt-muted">
                I accept the{" "}
                <Link 
                  to="/terms-and-conditions" 
                  className="text-mt-text hover:text-mt-text font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms and Conditions
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full text-mt-btn-text py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-mt-btn"
            >
              {status === "loading" ? "Creating..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-grow h-px bg-mt-line-strong" />
            <span className="mx-4 text-mt-subtle text-sm">OR</span>
            <div className="flex-grow h-px bg-mt-line-strong" />
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

          <div className="text-center text-sm text-mt-muted mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-mt-text font-medium hover:text-mt-text">
              Log in
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
