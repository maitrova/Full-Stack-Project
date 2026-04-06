import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import {
  fetchCompanyDocumentByName,
  selectCurrentDocument,
  selectLoading,
  selectError,
} from "../redux/slices/companyPdfSlice.js";
import PolicyContent from "../components/policies/PolicyContent.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Shipping = () => {
  const dispatch = useDispatch();
  const { name } = useParams();

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
      <div className="flex h-screen w-full items-center justify-center bg-white">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white text-red-500">
        {error}
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white text-gray-500">
        Policy not available.
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white">
      {document.contentType === "html" && document.content ? (
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
          <div className="rounded-3xl border border-gray-200 bg-white px-5 py-8 shadow-sm md:px-10 md:py-12">
            <PolicyContent content={document.content} />
          </div>
        </div>
      ) : document.filePath ? (
        <iframe
          src={`${API_BASE}/${document.filePath}#toolbar=0&navpanes=0&scrollbar=0`}
          className="h-screen w-full border-0 bg-white"
          title={name}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          Policy content is empty.
        </div>
      )}
    </div>
  );
};

export default Shipping;
