import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const IMAGE_BASE =
  import.meta.env.VITE_IMAGE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const formatDate = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
};

const getAssetUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `${IMAGE_BASE}/${value.replace(/^\/+/, "")}`;
};

const paymentStatusClass = (status) => {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING_PAYMENT") return "bg-amber-100 text-amber-700";
  if (status === "FAILED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
};

const orderStatusClass = (status) => {
  if (status === "DELIVERED") return "bg-emerald-100 text-emerald-700";
  if (status === "SHIPPED") return "bg-violet-100 text-violet-700";
  if (status === "READY") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
};

const UserManagement = () => {
  const token = useSelector(selectCurrentToken);
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    if (!token) return;

    const timeoutId = setTimeout(async () => {
      try {
        setUsersLoading(true);
        setUsersError("");

        const response = await axios.get(`${API_BASE}/auth/admin/users`, {
          params: searchTerm.trim() ? { search: searchTerm.trim() } : {},
          headers: { Authorization: `Bearer ${token}` },
        });

        const nextUsers = response.data?.users || [];
        setUsers(nextUsers);

        if (!nextUsers.length) {
          setSelectedUserId("");
          setSelectedUser(null);
          return;
        }

        setSelectedUserId((currentSelectedUserId) => {
          const hasSelectedUser = nextUsers.some(
            (user) => String(user._id) === String(currentSelectedUserId)
          );
          return !currentSelectedUserId || !hasSelectedUser
            ? String(nextUsers[0]._id)
            : currentSelectedUserId;
        });
      } catch (error) {
        setUsersError(
          error.response?.data?.message || "Failed to load users"
        );
      } finally {
        setUsersLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, token]);

  useEffect(() => {
    if (!token || !selectedUserId) return;

    const loadUserDetails = async () => {
      try {
        setDetailsLoading(true);
        setDetailsError("");

        const response = await axios.get(
          `${API_BASE}/auth/admin/users/${selectedUserId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setSelectedUser(response.data || null);
      } catch (error) {
        setDetailsError(
          error.response?.data?.message || "Failed to load user details"
        );
        setSelectedUser(null);
      } finally {
        setDetailsLoading(false);
      }
    };

    loadUserDetails();
  }, [selectedUserId, token]);

  const totalOrders = users.reduce(
    (sum, user) => sum + Number(user.stats?.totalOrders || 0),
    0
  );
  const deliveredOrders = users.reduce(
    (sum, user) => sum + Number(user.stats?.deliveredOrders || 0),
    0
  );
  const totalRevenue = users.reduce(
    (sum, user) => sum + Number(user.stats?.totalSpent || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Orders</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalOrders}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Delivered Orders</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{deliveredOrders}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Paid Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Customer Directory</h3>
            <p className="text-sm text-slate-500">
              Open any user to review profile, address, orders, and delivered items.
            </p>
          </div>
          <div className="w-full lg:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, or phone"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <h4 className="text-base font-semibold text-slate-900">Users</h4>
          </div>

          {usersLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          ) : usersError ? (
            <div className="p-5 text-sm text-rose-600">{usersError}</div>
          ) : users.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Spent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const isActive = String(user._id) === String(selectedUserId);

                    return (
                      <tr
                        key={user._id}
                        className={isActive ? "bg-blue-50" : "bg-white"}
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{user.name}</p>
                            <p className="text-sm text-slate-500">{user.email || "No email"}</p>
                            <p className="text-sm text-slate-500">{user.phone || "No phone"}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              {user.role} • joined {formatDate(user.createdAt)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <p>{user.stats?.totalOrders || 0} total</p>
                          <p>{user.stats?.deliveredOrders || 0} delivered</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm font-medium text-slate-900">
                          {formatCurrency(user.stats?.totalSpent || 0)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <button
                            onClick={() => setSelectedUserId(String(user._id))}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                              isActive
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {detailsLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          ) : detailsError ? (
            <div className="rounded-2xl bg-white p-5 text-sm text-rose-600 shadow-sm ring-1 ring-slate-200">
              {detailsError}
            </div>
          ) : !selectedUser ? (
            <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              Select a user to view details.
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                      Personal Details
                    </p>
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {selectedUser.user?.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedUser.user?.email || "No email"} • {selectedUser.user?.phone || "No phone"}
                    </p>
                    <p className="text-sm text-slate-500">
                      Role: {selectedUser.user?.role} • Joined {formatDate(selectedUser.user?.createdAt)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedUser.stats?.totalOrders || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Delivered</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedUser.stats?.deliveredOrders || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Spent</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {formatCurrency(selectedUser.stats?.totalSpent || 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Items Ordered</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedUser.stats?.totalItemsOrdered || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Items Received</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedUser.stats?.totalItemsReceived || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-900">Saved Addresses</h4>
                  <span className="text-sm text-slate-500">
                    {selectedUser.addresses?.length || 0} records
                  </span>
                </div>

                {selectedUser.addresses?.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {selectedUser.addresses.map((address) => (
                      <div
                        key={address._id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                            {address.type}
                          </span>
                          {address.isDefault && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-slate-900">{address.fullName}</p>
                        <p className="mt-1 text-sm text-slate-600">{address.mobileNumber}</p>
                        <p className="mt-3 text-sm text-slate-600">{address.completeAddress}</p>
                        {address.landmark ? (
                          <p className="mt-1 text-sm text-slate-500">Landmark: {address.landmark}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-slate-500">
                          {address.city}, {address.state} - {address.pincode}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No saved addresses found.</p>
                )}
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-900">Received Items</h4>
                  <span className="text-sm text-slate-500">
                    {selectedUser.receivedItems?.length || 0} delivered line items
                  </span>
                </div>

                {selectedUser.receivedItems?.length ? (
                  <div className="space-y-3">
                    {selectedUser.receivedItems.map((item, index) => (
                      <div
                        key={`${item.orderId}-${index}`}
                        className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
                            {item.previewImage ? (
                              <img
                                src={getAssetUrl(item.previewImage)}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-sm text-slate-500">
                              Qty {item.qty} {item.size ? `• Size ${item.size}` : ""}
                            </p>
                            <p className="text-sm text-slate-500">
                              Received on {formatDate(item.deliveredAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          {formatCurrency(item.unitPrice, item.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No delivered items yet.</p>
                )}
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-900">Order History</h4>
                  <span className="text-sm text-slate-500">
                    {selectedUser.orders?.length || 0} orders
                  </span>
                </div>

                {selectedUser.orders?.length ? (
                  <div className="space-y-4">
                    {selectedUser.orders.map((order) => (
                      <div
                        key={order._id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">
                                Order #{String(order._id).slice(-8)}
                              </p>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusClass(order.status)}`}
                              >
                                {order.status}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusClass(order.orderStatus)}`}
                              >
                                {order.orderStatus}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              Created {formatDate(order.createdAt)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Total {formatCurrency(order.total, order.currency)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <p>Subtotal: {formatCurrency(order.subtotal, order.currency)}</p>
                            <p>Shipping: {formatCurrency(order.shipping, order.currency)}</p>
                            <p>Discount: {formatCurrency(order.discount, order.currency)}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
                          <div className="space-y-3">
                            {(order.items || []).map((item, index) => (
                              <div
                                key={`${order._id}-${index}`}
                                className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-white">
                                    {item.previewImage ? (
                                      <img
                                        src={getAssetUrl(item.previewImage)}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{item.name}</p>
                                    <p className="text-sm text-slate-500">
                                      {item.kind} • Qty {item.qty}
                                      {item.size ? ` • Size ${item.size}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-sm font-medium text-slate-900">
                                  {formatCurrency(item.unitPrice, order.currency)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-xl border border-slate-200 p-4">
                              <p className="text-sm font-semibold text-slate-900">Delivery Address</p>
                              {order.deliveryAddress ? (
                                <div className="mt-2 text-sm text-slate-600">
                                  <p>{order.deliveryAddress.fullName}</p>
                                  <p>{order.deliveryAddress.mobileNumber}</p>
                                  <p className="mt-2">{order.deliveryAddress.completeAddress}</p>
                                  <p>
                                    {order.deliveryAddress.city}, {order.deliveryAddress.state} -{" "}
                                    {order.deliveryAddress.pincode}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-slate-500">No delivery address</p>
                              )}
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4">
                              <p className="text-sm font-semibold text-slate-900">Billing Address</p>
                              {order.billingAddress ? (
                                <div className="mt-2 text-sm text-slate-600">
                                  <p>{order.billingAddress.fullName}</p>
                                  <p>{order.billingAddress.mobileNumber}</p>
                                  <p className="mt-2">{order.billingAddress.completeAddress}</p>
                                  <p>
                                    {order.billingAddress.city}, {order.billingAddress.state} -{" "}
                                    {order.billingAddress.pincode}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-slate-500">No billing address</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No orders found for this user.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
