import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUserProfile,
  updateUserProfile,
  selectCurrentUser,
  selectUserProfile,
  selectProfileStatus,
  selectProfileError,
} from "../redux/slices/Userslice.js";
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Briefcase,
  Upload,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react"; // or any icon library

const ProfilePage = () => {
  const dispatch = useDispatch();

  const userInfo = useSelector(selectCurrentUser);
  const profile = useSelector(selectUserProfile);
  const profileStatus = useSelector(selectProfileStatus);
  const profileError = useSelector(selectProfileError);

  const sourceUser = useMemo(() => {
    return profile || userInfo || null;
  }, [profile, userInfo]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (userInfo?.token) dispatch(fetchUserProfile());
  }, [dispatch, userInfo?.token]);

  useEffect(() => {
    if (!sourceUser) return;
    setForm((prev) => ({
      ...prev,
      name: sourceUser?.name || "",
      phone: sourceUser?.phone || "",
      email: sourceUser?.email || "",
      role: sourceUser?.role || "",
      password: "",
      confirmPassword: "",
    }));
  }, [sourceUser]);

  const onChange = (e) => {
    setSuccessMsg("");
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");

    if (!userInfo?.token) return;

    if (form.password && form.password !== form.confirmPassword) {
      setSuccessMsg("❌ Passwords do not match");
      return;
    }

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      role: form.role,
    };

    if (form.password) payload.password = form.password;

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    const result = await dispatch(updateUserProfile(payload));
    
    clearInterval(interval);
    setUploadProgress(100);

    setTimeout(() => {
      setUploadProgress(0);
      if (updateUserProfile.fulfilled.match(result)) {
        setSuccessMsg("✅ Profile updated successfully");
        setIsEditing(false);
        setForm((p) => ({ ...p, password: "", confirmPassword: "" }));
      }
    }, 500);
  };

  const isLoading = profileStatus === "loading";
  const isLoggedIn = !!userInfo?.token;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate file upload
      setUploadProgress(30);
      setTimeout(() => setUploadProgress(70), 300);
      setTimeout(() => {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 500);
        setSuccessMsg("✅ Profile picture updated");
      }, 600);
    }
  };

  return (
    <div className="min-h-screen bg-mt-bg font-brand text-mt-text [color-scheme:var(--mt-scheme)]">
      {/* Enhanced Header */}
      <div className="text-mt-btn-text shadow-xl bg-mt-btn">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-normal tracking-tight">Agent Profile</h1>
              <p className="text-mt-line-strong mt-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Manage your professional identity and credentials
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-mt-tint/10 rounded-xl backdrop-blur-sm">
                <span className="text-sm font-medium">Status: </span>
                <span className="text-green-400 font-semibold">Active</span>
              </div>
              <div className="px-4 py-2 bg-mt-tint/10 rounded-xl backdrop-blur-sm border border-mt-line-strong">
                <span className="text-sm font-medium">Role: </span>
                <span className="text-mt-text font-semibold">{sourceUser?.role || "Agent"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isLoggedIn ? (
          <div className="bg-mt-surface/90 backdrop-blur-sm rounded-2xl border border-mt-line shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-mt-text">Authentication Required</h3>
            <p className="text-mt-muted mt-2">Please login to access your professional profile</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Panel - Profile Card */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-mt-surface/90 backdrop-blur-sm rounded-2xl border border-mt-line shadow-lg p-6">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-2xl mx-auto flex items-center justify-center text-mt-btn-text text-4xl font-bold shadow-lg bg-mt-btn">
                    {(sourceUser?.name || "U")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("")}
                  </div>
                  <label className="absolute bottom-2 right-1/4 bg-mt-btn text-mt-btn-text p-2 rounded-full cursor-pointer hover:bg-mt-btn-hover transition-all shadow-lg">
                    <Upload className="w-5 h-5" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {uploadProgress > 0 && (
                  <div className="mt-4">
                    <div className="h-2 bg-mt-line rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300 bg-mt-btn"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-mt-subtle text-center mt-1">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                )}

                <div className="text-center mt-6">
                  <h2 className="text-xl font-normal text-mt-text">
                    {sourceUser?.name || "Agent"}
                  </h2>
                  <p className="text-mt-muted mt-1 flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" />
                    {sourceUser?.email || "agent@example.com"}
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mt-3 border border-mt-line-strong bg-mt-surface-raised">
                    <Briefcase className="w-4 h-4 text-mt-text" />
                    <span className="text-mt-text font-semibold text-sm">
                      {sourceUser?.role || "Professional Agent"}
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between p-3 bg-mt-bg rounded-xl hover:bg-mt-tint/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-mt-muted" />
                      <span className="text-mt-muted">Phone</span>
                    </div>
                    <span className="font-semibold text-mt-text">
                      {sourceUser?.phone || "Not set"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-mt-bg rounded-xl hover:bg-mt-tint/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-mt-muted" />
                      <span className="text-mt-muted">User ID</span>
                    </div>
                    <span className="font-mono text-sm text-mt-text">
                      {sourceUser?._id?.slice(-8) || "N/A"}
                    </span>
                  </div>
                </div>

                {successMsg && (
                  <div className="mt-6 p-4 border border-mt-success/30 rounded-xl bg-mt-surface-raised">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-mt-success" />
                      <span className="text-mt-success font-medium">{successMsg}</span>
                    </div>
                  </div>
                )}

                {profileError && (
                  <div className="mt-6 p-4 border border-mt-danger/30 rounded-xl bg-mt-surface-raised">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-mt-danger" />
                      <span className="text-mt-danger font-medium">{profileError}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats Card */}
              <div className="text-mt-btn-text rounded-2xl p-6 shadow-xl bg-mt-btn">
                <h3 className="font-semibold text-mt-line-strong mb-4">Profile Strength</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Completeness</span>
                      <span>85%</span>
                    </div>
                    <div className="h-2 bg-mt-line rounded-full overflow-hidden">
                      <div className="h-full w-4/5 bg-mt-btn" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Verification</span>
                      <span>Verified ✅</span>
                    </div>
                    <div className="h-2 bg-mt-line rounded-full overflow-hidden">
                      <div className="h-full w-full bg-mt-success" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Edit Form */}
            <div className="lg:col-span-3">
              <div className="bg-mt-surface/90 backdrop-blur-sm rounded-2xl border border-mt-line shadow-lg overflow-hidden">
                <div className="px-8 py-6 border-b border-mt-line bg-mt-bg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-normal text-mt-text">Profile Configuration</h2>
                      <p className="text-mt-muted mt-1">Update your professional details and security settings</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                          isEditing 
                            ? 'text-mt-btn-text shadow-lg bg-mt-btn' 
                            : 'bg-mt-surface-raised text-mt-muted hover:bg-mt-tint/15'
                        }`}
                      >
                        {isEditing ? 'Editing Mode' : 'Edit Profile'}
                      </button>
                      {isLoading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 text-mt-warning rounded-xl">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">Processing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Personal Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <User className="w-6 h-6 text-mt-text" />
                        <h3 className="text-lg font-semibold text-mt-text">Personal Information</h3>
                      </div>
                      
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-mt-muted mb-2">
                            Full Name
                          </label>
                          <input
                            name="name"
                            value={form.name}
                            onChange={onChange}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                            placeholder="Enter your full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-mt-muted mb-2">
                            Email Address
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-mt-subtle" />
                            <input
                              name="email"
                              type="email"
                              value={form.email}
                              onChange={onChange}
                              disabled={!isEditing}
                              className="w-full pl-12 pr-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                              placeholder="professional@email.com"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-mt-muted mb-2">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-mt-subtle" />
                            <input
                              name="phone"
                              value={form.phone}
                              onChange={onChange}
                              disabled={!isEditing}
                              className="w-full pl-12 pr-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                              placeholder="+1 (555) 000-0000"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Professional Details */}
                    <div className="space-y-6">
                      {/* <div className="flex items-center gap-3">
                        <Briefcase className="w-6 h-6 text-mt-text" />
                        <h3 className="text-lg font-semibold text-mt-text">Professional Details</h3>
                      </div> */}
                      
                      {/* <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-mt-muted mb-2">
                            Role / Position
                          </label>
                          <select
                            name="role"
                            value={form.role}
                            onChange={onChange}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                          >
                            <option value="">Select Role</option>
                            <option value="Senior Agent">Senior Agent</option>
                            <option value="Lead Agent">Lead Agent</option>
                            <option value="Managing Agent">Managing Agent</option>
                            <option value="Executive Agent">Executive Agent</option>
                            <option value="Principal Agent">Principal Agent</option>
                          </select>
                          <p className="text-xs text-mt-subtle mt-2">
                            Select your current professional designation
                          </p>
                        </div>

                        <div className="p-4 rounded-xl border border-mt-line-strong bg-mt-surface-raised">
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-mt-text" />
                            <div>
                              <h4 className="font-semibold text-mt-text">Verification Status</h4>
                              <p className="text-sm text-mt-text mt-1">Identity verified • Profile active</p>
                            </div>
                          </div>
                        </div>
                      </div> */}
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="mt-12 pt-8 border-t border-mt-line">
                    <div className="flex items-center gap-3 mb-6">
                      <Key className="w-6 h-6 text-mt-warning" />
                      <h3 className="text-lg font-semibold text-mt-text">Security Settings</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-mt-muted mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={onChange}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-mt-subtle hover:text-mt-text"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-mt-muted mb-2">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={form.confirmPassword}
                            onChange={onChange}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-mt-line-strong bg-mt-surface text-mt-text outline-none transition-all focus:ring-3 focus:ring-mt-tint/10 focus:border-mt-text disabled:bg-mt-bg disabled:text-mt-subtle"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-mt-subtle hover:text-mt-text"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 rounded-xl border border-amber-400/30 bg-mt-surface-raised">
                      <p className="text-sm text-mt-warning">
                        🔒 Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-12 pt-6 border-t border-mt-line flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-mt-subtle">
                      Last updated: {new Date().toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (!sourceUser) return;
                          setSuccessMsg("");
                          setForm((prev) => ({
                            ...prev,
                            name: sourceUser?.name || "",
                            phone: sourceUser?.phone || "",
                            email: sourceUser?.email || "",
                            role: sourceUser?.role || "",
                            password: "",
                            confirmPassword: "",
                          }));
                          setIsEditing(false);
                        }}
                        disabled={isLoading || !isEditing}
                        className="px-6 py-3 rounded-xl border border-mt-line-strong text-mt-muted font-medium hover:bg-mt-tint/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reset Changes
                      </button>
                      
                      <button
                        type="submit"
                        disabled={isLoading || !isEditing}
                        className="px-8 py-3 rounded-xl text-mt-btn-text font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-mt-btn"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;