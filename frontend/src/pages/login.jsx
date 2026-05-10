import React, { useState, useEffect } from 'react';
import { FiLock, FiLogIn, FiPhone, FiMail, FiEyeOff, FiEye } from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  loginUser, 
  googleLogin, 
  forgotPassword, 
  resetPassword,
  selectForgotStatus,
  selectForgotError,
  selectResetStatus,
  selectResetError,
  selectResetSuccess
} from '../redux/slices/Userslice.js';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState('email'); // 'email', 'otp', 'success'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { userInfo, status, error } = useSelector((state) => state.user);
  const forgotStatus = useSelector(selectForgotStatus);
  const forgotError = useSelector(selectForgotError);
  const resetStatus = useSelector(selectResetStatus);
  const resetError = useSelector(selectResetError);
  const resetSuccess = useSelector(selectResetSuccess);

  // Redirect after ANY login (normal or Google)
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

  // Handle forgot password success
  useEffect(() => {
    if (forgotStatus === 'succeeded') {
      setForgotStep('otp');
    }
  }, [forgotStatus]);

  // Handle reset password success
  useEffect(() => {
    if (resetStatus === 'succeeded' && resetSuccess) {
      setForgotStep('success');
      // Auto close modal after 3 seconds
      setTimeout(() => {
        setShowForgotModal(false);
        resetForm();
      }, 3000);
    }
  }, [resetStatus, resetSuccess]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  // Forgot password handlers
  const handleForgotPassword = (e) => {
    e.preventDefault();
    setShowForgotModal(true);
    setForgotStep('email');
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!email) return;
    dispatch(forgotPassword(email));
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    setPasswordError('');
    dispatch(resetPassword({ email, otp, newPassword }));
  };

  const resetForm = () => {
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setForgotStep('email');
  };

  const closeModal = () => {
    setShowForgotModal(false);
    resetForm();
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
                Phone or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  {String(formData.identifier || "").includes("@") ? (
                    <FiMail className="text-gray-400" />
                  ) : (
                    <FiPhone className="text-gray-400" />
                  )}
                </div>
                <input
                  type="text"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter phone or email"
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
    {/* Lock Icon */}
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
      <FiLock className="text-gray-400" />
    </div>

    {/* Password Input */}
    <input
      type={showPassword ? "text" : "password"}
      name="password"
      value={formData.password}
      onChange={handleChange}
      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      placeholder="Enter password"
      required
    />

    {/* Eye Button */}
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 transition"
    >
      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
    </button>
  </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition duration-300 font-medium"
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
            <Link to="/register" className="text-purple-600 font-medium hover:text-purple-800">
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative animate-fadeIn">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {forgotStep === 'email' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Forgot Password?</h2>
                <p className="text-gray-600 mb-6">Enter your email to receive an OTP</p>
                
                {forgotError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleSendOtp}>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <FiMail className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotStatus === 'loading'}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition duration-300 font-medium disabled:opacity-50"
                  >
                    {forgotStatus === 'loading' ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 'otp' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>
                <p className="text-gray-600 mb-6">Enter the OTP sent to {email}</p>
                
                {(resetError || passwordError) && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                    {resetError || passwordError}
                  </div>
                )}

                <form onSubmit={handleResetPassword}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter OTP"
                      required
                      maxLength="6"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <FiLock className="text-gray-400" />
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter new password"
                        required
                        minLength="6"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <FiLock className="text-gray-400" />
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Confirm new password"
                        required
                        minLength="6"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition duration-300 font-medium disabled:opacity-50"
                  >
                    {resetStatus === 'loading' ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>

                <button
                  onClick={() => setForgotStep('email')}
                  className="mt-4 text-sm text-purple-600 hover:text-purple-800 font-medium w-full text-center"
                >
                  ← Back to email
                </button>
              </div>
            )}

            {forgotStep === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h2>
                <p className="text-gray-600 mb-4">
                  Your password has been reset successfully. You can now login with your new password.
                </p>
                <button
                  onClick={closeModal}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition duration-300 font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
