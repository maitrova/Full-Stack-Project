import express from 'express';
import {
  adminGetUserById,
  adminGetUsers,
  forgotPassword,
  getUserProfile,
  googleLogin,
  loginUser,
  registerUser,
  resetPassword,
  updateUserProfile,
} from '../controllers/auth.js';
import { protect } from '../middleware/authMiddleware.js';
const authrouter = express.Router();

authrouter.post('/register', registerUser);
authrouter.post('/login', loginUser);
authrouter.post('/google', googleLogin);
authrouter.get("/admin/users", protect, adminGetUsers);
authrouter.get("/admin/users/:userId", protect, adminGetUserById);
authrouter.get("/profile", protect, getUserProfile);
authrouter.put("/profile", protect, updateUserProfile);

authrouter.post("/forgot-password", forgotPassword);
authrouter.post("/reset-password", resetPassword);
// need to do it 
// router.delete("/delete",deleteUser)

export default authrouter;
