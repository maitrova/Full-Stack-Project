import jwt from 'jsonwebtoken';
import User from '../models/authmodel.js'

const extractBearerToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

const attachUserFromToken = async (req) => {
  const token = extractBearerToken(req);
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');
  req.user = user;
  return user;
};

export const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    await attachUserFromToken(req);
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const optionalProtect = async (req, _res, next) => {
  try {
    await attachUserFromToken(req);
  } catch (error) {
    console.warn("optionalProtect token parse failed:", error.message);
  }

  next();
};
