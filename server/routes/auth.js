import express from 'express';
import { loginUser, registerUser } from '../controllers/auth.js';

const authrouter = express.Router();

authrouter.post('/register', registerUser);
authrouter.post('/login', loginUser);
// need to do it 
// router.delete("/delete",deleteUser)

export default authrouter;