// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const ProtectedRoute = ({ children }) => {
  const token = useSelector(selectCurrentToken);
  const location = useLocation();

  // Not logged in → redirect to login
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }} // optional: redirect back after login
      />
    );
  }

  return children;
};

export default ProtectedRoute;
