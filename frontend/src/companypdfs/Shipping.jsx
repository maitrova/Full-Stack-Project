// src/pages/Shipping.jsx
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import {
  fetchCompanyDocumentByName,
  selectCurrentDocument,
  selectLoading,
  selectError,
} from "../redux/slices/companyPdfSlice.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Shipping = () => {
  const dispatch = useDispatch();
  const { name } = useParams(); // 👈 get name from URL

  const document = useSelector(selectCurrentDocument);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);

  useEffect(() => {
    if (name) {
      dispatch(fetchCompanyDocumentByName(name));
    }
  }, [dispatch, name]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white">
      {document?.filePath && (
        <iframe
          src={`${API_BASE}/${document.filePath}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0 bg-white"
          title={name}
        />
      )}
    </div>
  );
};

export default Shipping;