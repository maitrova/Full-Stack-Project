
import jwt from 'jsonwebtoken';
import User from '../models/authmodel.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 📌 Register
export const registerUser = async (req, res) => {
  const { name, phone, email, password,role } = req.body;
  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    const user = await User.create({ name, phone, email, password,role });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id),
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// 📌 Login
export const loginUser = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ phone });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id),
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};





// ✅ GET: /api/auth/profile
export const getUserProfile = async (req, res) => {
  try {
    // req.user is already set by protect middleware
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
};

// ✅ PUT: /api/auth/profile
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // update only if sent
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.email !== undefined) user.email = req.body.email;

    // If you do NOT want normal users to change role, remove this line:
    if (req.body.role !== undefined) user.role = req.body.role;

    // password update (your model should hash in pre-save)
    if (req.body.password) user.password = req.body.password;

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      token: generateToken(updated._id), // optional refresh token
    });
  } catch (err) {
    res.status(500).json({ message: "Profile update failed", error: err.message });
  }
};
