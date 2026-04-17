import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  adminFetchReturnRequests,
  adminUpdateReturnRequest,
  adminUpdateReturnRefundStatus,
  selectAdminReturns,
  selectAdminReturnsLoading,
  selectAdminReturnsError,
  selectUpdateReturnLoading,
  selectUpdateReturnError,
} from '../../redux/slices/orderSlice.js';

const ReturnManagement = () => {
  const dispatch = useDispatch();
  const returns = useSelector(selectAdminReturns);
  const loading = useSelector(selectAdminReturnsLoading);
  const error = useSelector(selectAdminReturnsError);
  const updateLoading = useSelector(selectUpdateReturnLoading);
  const updateError = useSelector(selectUpdateReturnError);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const API_BASE_URL = (
    import.meta.env.VITE_IMAGE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000'
  ).replace(/\/+$/, '');
  const ORIGIN_BASE_URL = API_BASE_URL.replace(/\/api$/i, '');
  const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
  const SPECIAL_URL_RE = /^(?:data:|blob:)/i;

  useEffect(() => {
    dispatch(adminFetchReturnRequests());
  }, [dispatch]);

  const resolveImageUrl = (path) => {
    const rawPath = String(path || '').trim();
    if (!rawPath) return '';
    if (ABSOLUTE_URL_RE.test(rawPath) || SPECIAL_URL_RE.test(rawPath)) {
      return rawPath;
    }

    const normalizedPath = rawPath.replace(/\\/g, '/');

    if (normalizedPath.startsWith('/api/')) {
      return `${ORIGIN_BASE_URL}${normalizedPath}`;
    }
    if (normalizedPath.startsWith('api/')) {
      return `${ORIGIN_BASE_URL}/${normalizedPath}`;
    }
    if (normalizedPath.startsWith('/outputs/')) {
      return `${ORIGIN_BASE_URL}/api${normalizedPath}`;
    }
    if (normalizedPath.startsWith('outputs/')) {
      return `${ORIGIN_BASE_URL}/api/${normalizedPath}`;
    }

    return `${API_BASE_URL}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredReturns = useMemo(() => {
    if (statusFilter === 'ALL') return returns;
    return returns.filter((order) => order.returnRequest?.status === statusFilter);
  }, [returns, statusFilter]);

  const handleDecision = async (orderId, status) => {
    await dispatch(adminUpdateReturnRequest({
      orderId,
      status,
      adminDecisionNote: selectedOrderId === orderId ? decisionNote : '',
    })).unwrap();
    setSelectedOrderId(null);
    setDecisionNote('');
  };

  const handleRefundStatusUpdate = async (orderId, refundStatus) => {
    await dispatch(adminUpdateReturnRefundStatus({ orderId, refundStatus })).unwrap();
  };

  const getStatusClasses = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-700 border border-rose-200';
      default:
        return 'bg-amber-100 text-amber-700 border border-amber-200';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Return Management</h2>
          <p className="mt-1 text-sm text-slate-600">Approve or reject customer return requests and review refund details.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="ALL">All statuses</option>
          <option value="PROCESSING">Processing</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {updateError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {updateError}
        </div>
      ) : null}

      {!filteredReturns.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No return requests found.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReturns.map((order) => {
            const returnRequest = order.returnRequest || {};
            const bankDetails = returnRequest.bankDetails || {};
            const isDecisionOpen = selectedOrderId === order._id;

            return (
              <div key={order._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Order #{order._id.slice(-8).toUpperCase()}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(returnRequest.status)}`}>
                        {returnRequest.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {order.user?.name || 'Customer'} · {order.user?.email || 'No email'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Requested: {formatDate(returnRequest.requestedAt)} · Deadline: {formatDate(order.returnDeadlineAt)}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600">
                    <p><span className="font-medium text-slate-900">Refund method:</span> {bankDetails.method || 'N/A'}</p>
                    <p>
                      <span className="font-medium text-slate-900">Refund payout:</span> {returnRequest.refundStatus === 'PAID' ? 'Paid' : 'Not paid'}
                    </p>
                    {returnRequest.refundPaidAt ? (
                      <p><span className="font-medium text-slate-900">Refund paid at:</span> {formatDate(returnRequest.refundPaidAt)}</p>
                    ) : null}
                    {bankDetails.method === 'UPI' ? (
                      <p><span className="font-medium text-slate-900">UPI:</span> {bankDetails.upiId || 'N/A'}</p>
                    ) : (
                      <>
                        <p><span className="font-medium text-slate-900">Account holder:</span> {bankDetails.accountHolderName || 'N/A'}</p>
                        <p><span className="font-medium text-slate-900">Account number:</span> {bankDetails.accountNumber || 'N/A'}</p>
                        <p><span className="font-medium text-slate-900">IFSC:</span> {bankDetails.ifscCode || 'N/A'}</p>
                        <p><span className="font-medium text-slate-900">Bank:</span> {bankDetails.bankName || 'N/A'}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Return Reason</p>
                      <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {returnRequest.reason || 'No reason provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">Proof Images</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                        {(returnRequest.imageUrls || []).map((imageUrl) => (
                          <a
                            key={imageUrl}
                            href={resolveImageUrl(imageUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                          >
                            <img
                              src={resolveImageUrl(imageUrl)}
                              alt="Return proof"
                              className="h-32 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>

                    {returnRequest.adminDecisionNote ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Admin Note</p>
                        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {returnRequest.adminDecisionNote}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Returned Order Items</p>
                    <div className="mt-3 space-y-3">
                      {(order.items || []).map((item, index) => (
                        <div key={`${order._id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">
                            {item.readymadeProduct?.title || item.design?.title || item.design?.productName || item.dropproduct?.name || item.product?.name || 'Product'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Qty: {item.qty || 0} {item.size ? `· Size: ${item.size}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>

                    {['PROCESSING', 'APPROVED', 'REJECTED'].includes(returnRequest.status) ? (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={isDecisionOpen ? decisionNote : ''}
                          onFocus={() => {
                            setSelectedOrderId(order._id);
                            setDecisionNote(returnRequest.adminDecisionNote || '');
                          }}
                          onChange={(event) => {
                            setSelectedOrderId(order._id);
                            setDecisionNote(event.target.value);
                          }}
                          rows={4}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="Optional admin note"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleDecision(order._id, 'APPROVED')}
                            disabled={updateLoading}
                            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                              returnRequest.status === 'APPROVED'
                                ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'text-white'
                            } ${
                              updateLoading
                                ? 'cursor-not-allowed bg-emerald-300 text-white'
                                : returnRequest.status === 'APPROVED'
                                ? ''
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            Approve Return
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecision(order._id, 'REJECTED')}
                            disabled={updateLoading}
                            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                              returnRequest.status === 'REJECTED'
                                ? 'border border-rose-300 bg-rose-50 text-rose-700'
                                : 'text-white'
                            } ${
                              updateLoading
                                ? 'cursor-not-allowed bg-rose-300 text-white'
                                : returnRequest.status === 'REJECTED'
                                ? ''
                                : 'bg-rose-600 hover:bg-rose-700'
                            }`}
                          >
                            Reject Return
                          </button>
                        </div>
                        {returnRequest.status === 'APPROVED' ? (
                          <>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                              Return approved. Update refund payout status after you transfer the money.
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleRefundStatusUpdate(order._id, 'NOT_PAID')}
                                disabled={updateLoading}
                                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                                  returnRequest.refundStatus === 'NOT_PAID'
                                    ? 'border border-amber-300 bg-amber-50 text-amber-700'
                                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                } ${updateLoading ? 'cursor-not-allowed opacity-60' : ''}`}
                              >
                                Mark Not Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRefundStatusUpdate(order._id, 'PAID')}
                                disabled={updateLoading}
                                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                                  updateLoading ? 'cursor-not-allowed bg-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                Mark Paid
                              </button>
                            </div>
                            <p className="text-xs text-slate-500">
                              User will see refund status immediately in the order page.
                            </p>
                          </>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            Decision made on {formatDate(returnRequest.decidedAt)}. You can still change the decision above.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        Decision made on {formatDate(returnRequest.decidedAt)}.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReturnManagement;
