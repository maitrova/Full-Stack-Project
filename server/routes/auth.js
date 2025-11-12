import express from 'express';
import { loginUser, registerUser } from '../controllers/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
// need to do it 
// router.delete("/delete",deleteUser)

export default router;
