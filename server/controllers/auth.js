import jwt from "jsonwebtoken";
import User from "../models/authmodel.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🔐 Generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};



// ================= REGISTER =================
export const registerUser = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!phone || !password || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      role: "user",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};



// ================= LOGIN =================
export const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });

    if (!user || !user.password || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
};



// ================= GOOGLE LOGIN =================
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, name, email } = payload;

    if (!email) {
      return res.status(400).json({ message: "Google account has no email" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Create new Google user
      user = await User.create({
        name,
        email,
        googleId: sub,
        role: "user",
      });
    } else if (!user.googleId) {
      // Link existing account to Google
      user.googleId = sub;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Google authentication failed" });
  }
};



// ================= GET PROFILE =================
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



// ================= UPDATE PROFILE =================
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.email !== undefined) user.email = req.body.email;

    // ❌ DO NOT allow role change here unless admin logic added

    if (req.body.password) user.password = req.body.password;

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      token: generateToken(updated._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Profile update failed" });
  }
};
