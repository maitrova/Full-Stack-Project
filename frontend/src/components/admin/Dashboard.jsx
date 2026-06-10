// components/admin/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CalendarClock,
  DollarSign,
  IndianRupee,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const SALES_OPTIONS = [
  { value: "today", label: "Today sales" },
  { value: "lastWeek", label: "Last week sales" },
  { value: "lastMonth", label: "Last month sales" },
  { value: "custom", label: "Custom date sales" },
];

const numberFormat = new Intl.NumberFormat("en-IN");
const moneyFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

const formatNumber = (value) => numberFormat.format(Number(value || 0));
const formatMoney = (value) => `Rs. ${moneyFormat.format(Number(value || 0))}`;

const formatDateTime = (value) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const StatCard = ({ icon, label, value, detail, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg border p-3 ${tones[tone] || tones.blue}`}>
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {detail ? <p className="mt-2 text-sm text-gray-500">{detail}</p> : null}
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
    {text}
  </div>
);

const Dashboard = () => {
  const token = useSelector(selectCurrentToken);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesRange, setSalesRange] = useState("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchSummary = async (params = {}) => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(`${API_BASE_URL}/orders/admin/dashboard-summary`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        withCredentials: true,
      });
      setSummary(response.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [token]);

  const selectedSales = useMemo(
    () => summary?.sales?.[salesRange] || { orders: 0, revenue: 0, items: 0 },
    [summary, salesRange]
  );

  const customDateLabel = useMemo(() => {
    const range = summary?.sales?.customRange;
    if (!range?.dateFrom && !range?.dateTo) return "Select dates to filter sales.";
    if (range.dateFrom && range.dateTo) return `${range.dateFrom} to ${range.dateTo}`;
    if (range.dateFrom) return `From ${range.dateFrom}`;
    return `Until ${range.dateTo}`;
  }, [summary]);

  const applyCustomSalesFilter = () => {
    if (!dateFrom && !dateTo) {
      return;
    }
    setSalesRange("custom");
    fetchSummary({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });
  };

  const clearCustomSalesFilter = () => {
    setDateFrom("");
    setDateTo("");
    setSalesRange("today");
    fetchSummary();
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
          <p className="font-medium text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Dashboard could not load</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => fetchSummary()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Package className="h-6 w-6" />}
          label="Total no. of products"
          value={formatNumber(summary?.totals?.products)}
          detail={`${formatNumber(summary?.totals?.readymadeProducts)} ready-made, ${formatNumber(summary?.totals?.dropProducts)} drop, ${formatNumber(summary?.totals?.customProducts)} custom`}
        />
        <StatCard
          icon={<DollarSign className="h-6 w-6" />}
          label="Total revenue of products"
          value={formatMoney(summary?.totals?.revenue)}
          detail="Paid and COD orders"
          tone="green"
        />
        <StatCard
          icon={<IndianRupee className="h-6 w-6" />}
          label="Total worth of all products"
          value={formatMoney(summary?.totals?.productWorth)}
          detail="Current inventory value"
          tone="green"
        />
        <StatCard
          icon={<ShoppingBag className="h-6 w-6" />}
          label="Pending orders"
          value={formatNumber(summary?.pendingOrders)}
          detail="Orders still in processing"
          tone="amber"
        />
        <StatCard
          icon={<RotateCcw className="h-6 w-6" />}
          label="Today returns"
          value={formatNumber(summary?.todayReturns?.count)}
          detail="Return requests submitted today"
          tone="red"
        />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sales</h3>
            <p className="text-sm text-gray-500">Choose a preset or filter sales by date.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <select
              value={salesRange}
              onChange={(event) => setSalesRange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-56"
            >
              {SALES_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === "custom" && !summary?.sales?.custom}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fetchSummary()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <label className="text-sm font-medium text-gray-700">
            From date
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            To date
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={applyCustomSalesFilter}
            disabled={!dateFrom && !dateTo}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearCustomSalesFilter}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        {salesRange === "custom" ? (
          <p className="mt-3 text-sm text-gray-500">{customDateLabel}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatMoney(selectedSales.revenue)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Orders</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(selectedSales.orders)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Items sold</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(selectedSales.items)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Low stock products</h3>
            <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
              {formatNumber(summary?.lowStockProducts?.length)} items
            </span>
          </div>

          {summary?.lowStockProducts?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="py-3 pr-4 font-medium">Product</th>
                    <th className="py-3 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">Category</th>
                    <th className="py-3 text-right font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.lowStockProducts.map((product) => (
                    <tr key={`${product.type}-${product.id}`}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">{formatMoney(product.price)}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{product.type}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        {[product.category, product.subCategory].filter(Boolean).join(" / ") || "Uncategorized"}
                      </td>
                      <td className="py-3 text-right">
                        <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                          {formatNumber(product.stock)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="No low stock products found." />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Recent activity</h3>
            </div>
            {summary?.recentActivity?.length ? (
              <div className="space-y-4">
                {summary.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="truncate text-sm text-gray-500">{activity.detail}</p>
                      <p className="mt-1 text-xs text-gray-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No recent activity found." />
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Offer ending products
              </h3>
            </div>
            {summary?.offerEndingProducts?.length ? (
              <div className="space-y-3">
                {summary.offerEndingProducts.map((product) => (
                  <div
                    key={`${product.type}-${product.id}`}
                    className="flex items-start justify-between gap-4 rounded-lg bg-amber-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        {product.type} - {formatMoney(product.salePrice)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs font-medium text-amber-800">
                      Ends
                      <br />
                      {formatDateTime(product.saleEndAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No offers are ending in the next 2 days." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
