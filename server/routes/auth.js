import express from 'express';
import { getUserProfile, googleLogin, loginUser, registerUser, updateUserProfile } from '../controllers/auth.js';
import { protect } from '../middleware/authMiddleware.js';
const authrouter = express.Router();

authrouter.post('/register', registerUser);
authrouter.post('/login', loginUser);
authrouter.post('/google', googleLogin);
authrouter.get("/profile", protect, getUserProfile);
authrouter.put("/profile", protect, updateUserProfile);
// need to do it 
// router.delete("/delete",deleteUser)

export default authrouter;