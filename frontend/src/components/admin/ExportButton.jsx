import { useDispatch, useSelector } from "react-redux";
import { exportOrdersToExcel } from "../../redux/slices/orderExportSlice.js";

const ExportButton = () => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.orderExport);

  return (
    <div className="flex justify-end">
      <button
        onClick={() => dispatch(exportOrdersToExcel())}
        disabled={loading}
        className={`
          flex items-center gap-2
          px-5 py-2.5
          rounded-lg
          text-sm font-semibold
          shadow-md
          transition-all duration-200
          ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
          }
          text-white
        `}
      >
        {loading && (
          <svg
            className="w-4 h-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="white"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="white"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}

        {loading ? "Exporting..." : "Export Orders"}
      </button>
    </div>
  );
};

export default ExportButton;
