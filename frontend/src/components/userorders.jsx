import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchMyPaidOrders,
  fetchMyPaidOrderById,
  cancelMyOrder,
  submitReturnRequest,
  selectMyPaidOrders,
  selectMyPaidOrdersLoading,
  selectMyPaidOrdersError,
  selectMyPaidOrder,
  selectMyPaidOrderLoading,
  selectCancelMyOrderLoading,
  selectCancelMyOrderError,
  selectCancellingOrderId,
  selectSubmitReturnLoading,
  selectSubmitReturnError,
  selectReturnSubmittingOrderId,
  clearOrderErrors,
  clearMyPaidOrder
} from '../redux/slices/orderSlice.js';
import {
  downloadInvoice,
  selectInvoiceLoading,
  selectInvoiceError,
  selectDownloadingOrderId,
  clearInvoiceError
} from '../redux/slices/invoiceSlice.js';
import { INDIAN_BANK_OPTIONS } from '../constants/indianBanks.js';
import { selectCurrentToken } from '../redux/slices/Userslice.js';
import ReviewModal from './ReviewModal.jsx';
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";
import { buildDropProductPath } from "../utils/dropProductRoutes.js";

const BankLogoBadge = ({ option, className = '' }) => (
  <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-bold tracking-wide text-white ${option.color} ${className}`}>
    {option.shortLabel}
  </span>
);

const BANK_OPTIONS = INDIAN_BANK_OPTIONS;

const BankLogoMark = ({ option, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!option?.domain || imageFailed) {
    return <BankLogoBadge option={option} className={className} />;
  }

  return (
    <img
      src={`https://img.logo.dev/${option.domain}?size=64&format=png`}
      alt={`${option.label} logo`}
      className={`h-8 w-8 rounded-full bg-white object-contain p-1 ring-1 ring-slate-200 ${className}`}
      onError={() => setImageFailed(true)}
      loading="lazy"
    />
  );
};

const UserOrders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Order selectors
  const orders = useSelector(selectMyPaidOrders);
  const loading = useSelector(selectMyPaidOrdersLoading);
  const error = useSelector(selectMyPaidOrdersError);
  const selectedOrder = useSelector(selectMyPaidOrder);
  const selectedOrderLoading = useSelector(selectMyPaidOrderLoading);
  const cancelOrderLoading = useSelector(selectCancelMyOrderLoading);
  const cancelOrderError = useSelector(selectCancelMyOrderError);
  const cancellingOrderId = useSelector(selectCancellingOrderId);
  const submitReturnLoading = useSelector(selectSubmitReturnLoading);
  const submitReturnError = useSelector(selectSubmitReturnError);
  const returnSubmittingOrderId = useSelector(selectReturnSubmittingOrderId);
  
  // Invoice selectors
  const invoiceLoading = useSelector(selectInvoiceLoading);
  const invoiceError = useSelector(selectInvoiceError);
  const downloadingOrderId = useSelector(selectDownloadingOrderId);
  const token = useSelector(selectCurrentToken);
  
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showInvoiceError, setShowInvoiceError] = useState(false);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [returnSuccessMessage, setReturnSuccessMessage] = useState('');
  const [cancelConfirmOrderId, setCancelConfirmOrderId] = useState(null);
  const [returnModalOrderId, setReturnModalOrderId] = useState(null);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [returnForm, setReturnForm] = useState({
    reason: '',
    method: 'UPI',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    upiId: '',
    images: [],
  });
  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    orderId: null,
    item: null,
    productName: '',
  });

  const API_BASE_URL = (
    import.meta.env.VITE_IMAGE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000'
  ).replace(/\/+$/, '');
  const ORIGIN_BASE_URL = API_BASE_URL.replace(/\/api$/i, '');
  const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
  const SPECIAL_URL_RE = /^(?:data:|blob:)/i;
  const FALLBACK_THUMBNAIL =
    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' dominant-baseline='middle' text-anchor='middle' font-family='Arial%2Csans-serif' font-size='12' fill='%239ca3af'%3ENo Image%3C/text%3E%3C/svg%3E";

  useEffect(() => {
    dispatch(fetchMyPaidOrders());
    return () => {
      dispatch(clearOrderErrors());
      dispatch(clearMyPaidOrder());
      dispatch(clearInvoiceError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (selectedOrderId) {
      dispatch(fetchMyPaidOrderById(selectedOrderId));
    }
  }, [selectedOrderId, dispatch]);

  useEffect(() => {
    if (invoiceError) {
      setShowInvoiceError(true);
      const timer = setTimeout(() => {
        setShowInvoiceError(false);
        dispatch(clearInvoiceError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [invoiceError, dispatch]);

  const handleViewDetails = (orderId) => {
    setSelectedOrderId(orderId);
    setShowOrderModal(true);
  };

  const closeModal = () => {
    setShowOrderModal(false);
    setSelectedOrderId(null);
    dispatch(clearMyPaidOrder());
  };

  const openReviewModal = (orderId, item) => {
    setReviewModalState({
      isOpen: true,
      orderId,
      item,
      productName: getItemName(item),
    });
  };

  const closeReviewModal = () => {
    setReviewModalState({
      isOpen: false,
      orderId: null,
      item: null,
      productName: '',
    });
  };

  const handleReviewSubmitted = async () => {
    await dispatch(fetchMyPaidOrders());

    if (selectedOrderId) {
      await dispatch(fetchMyPaidOrderById(selectedOrderId));
    }
  };

  const handleDownloadInvoice = (orderId) => {
    dispatch(downloadInvoice(orderId));
  };

  const canCancelOrder = (order) =>
    order?.orderStatus === 'PROCESSING' &&
    (order?.status === 'PAID' || order?.payment?.method === 'COD') &&
    order?.status !== 'CANCELLED';

  const canReturnOrder = (order) => Boolean(order?.returnEligible);

  const needsReturnSupport = (order) => Boolean(order?.returnRestrictedReason);

  const openCancelConfirm = (orderId) => {
    setCancelConfirmOrderId(orderId);
  };

  const closeCancelConfirm = () => {
    if (cancelOrderLoading) return;
    setCancelConfirmOrderId(null);
  };

  const handleCancelOrder = async (orderId) => {
    const resultAction = await dispatch(cancelMyOrder(orderId));

    if (cancelMyOrder.fulfilled.match(resultAction)) {
      setCancelSuccessMessage('Order cancelled successfully.');
      setCancelConfirmOrderId(null);
      setTimeout(() => setCancelSuccessMessage(''), 4000);
    }
  };

  const resetReturnForm = () => {
    setReturnForm({
      reason: '',
      method: 'UPI',
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branchName: '',
      upiId: '',
      images: [],
    });
  };

  const openReturnModal = (orderId) => {
    setReturnModalOrderId(orderId);
    resetReturnForm();
  };

  const closeReturnModal = () => {
    if (submitReturnLoading) return;
    setReturnModalOrderId(null);
    setShowBankDropdown(false);
    resetReturnForm();
  };

  const handleReturnInputChange = (event) => {
    const { name, value } = event.target;
    setReturnForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReturnImagesChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    setReturnForm((prev) => ({ ...prev, images: files }));
  };

  const selectedBankOption = BANK_OPTIONS.find((option) => option.value === returnForm.bankName) || null;

  const isReturnFormValid = () => {
    if (!returnForm.reason.trim() || returnForm.images.length === 0) {
      return false;
    }

    if (returnForm.method === 'UPI') {
      return Boolean(returnForm.upiId.trim());
    }

    return Boolean(
      returnForm.accountHolderName.trim() &&
      returnForm.accountNumber.trim() &&
      returnForm.ifscCode.trim() &&
      returnForm.bankName.trim() &&
      returnForm.branchName.trim()
    );
  };

  const handleSubmitReturnRequest = async (orderId) => {
    const formData = new FormData();
    formData.append('reason', returnForm.reason);
    formData.append('method', returnForm.method);
    formData.append('accountHolderName', returnForm.accountHolderName);
    formData.append('accountNumber', returnForm.accountNumber);
    formData.append('ifscCode', returnForm.ifscCode);
    formData.append('bankName', returnForm.bankName);
    formData.append('branchName', returnForm.branchName);
    formData.append('upiId', returnForm.upiId);
    returnForm.images.forEach((file) => formData.append('images', file));

    const resultAction = await dispatch(submitReturnRequest({ orderId, formData }));

    if (submitReturnRequest.fulfilled.match(resultAction)) {
      setReturnSuccessMessage('Return request submitted successfully.');
      closeReturnModal();
      setTimeout(() => setReturnSuccessMessage(''), 5000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-200',
      READY: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      SHIPPED: 'bg-purple-100 text-purple-800 border border-purple-200',
      DELIVERED: 'bg-green-100 text-green-800 border border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      PAID: 'bg-green-100 text-green-800 border border-green-200',
      PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      FAILED: 'bg-red-100 text-red-800 border border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border border-gray-200',
      COD: 'bg-sky-100 text-sky-800 border border-sky-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getDisplayPaymentStatus = (order) =>
    order?.payment?.method === 'COD' ? 'COD' : (order?.status || 'PENDING_PAYMENT');

  const calculateTotal = (order) => {
    if (!order?.items) return '0.00';
    return order.items.reduce((total, item) => {
      return total + (item.unitPrice * item.qty);
    }, 0).toFixed(2);
  };

  const getItemName = (item) => {
    if (item.kind === "READYMADE" && item.readymadeProduct?.title) {
      return item.readymadeProduct.title;
    } else if (item.kind === "DESIGN" && item.design?.name) {
      return item.design.name;
    } else if (item.dropproduct?.name) {
      return item.dropproduct.name;
    } else if (item.product?.name) {
      return item.product.name;
    }
    return 'Product';
  };

  const getItemType = (item) => {
    switch (item.kind) {
      case 'READYMADE':
        return 'Ready-made Product';
      case 'DESIGN':
        return 'User Designed Product';
      case 'DROPPRODUCT':
        return 'Drop Product';
      default:
        return 'Product';
    }
  };

  const getProductDetails = (item) => {
    if (item.kind === "READYMADE" && item.readymadeProduct) {
      return {
        isUserDesigned: false,
        category: item.readymadeProduct.category,
        subCategory: item.readymadeProduct.subCategory,
        brand: item.readymadeProduct.brand,
        description: item.readymadeProduct.description
      };
    } else if (item.kind === "DESIGN" && item.design) {
      return {
        isUserDesigned: true,
        category: 'Custom Design',
        subCategory: 'User Created',
        brand: 'Your Design',
        description: 'This is a custom design created by you'
      };
    } else if (item.dropproduct) {
      return {
        isUserDesigned: false,
        category: item.dropproduct.category || 'Drop Product',
        subCategory: item.dropproduct.subCategory || '',
        brand: item.dropproduct.brand || '',
        description: item.dropproduct.description || ''
      };
    } else if (item.product) {
      return {
        isUserDesigned: false,
        category: item.product.category || 'Product',
        subCategory: item.product.subCategory || '',
        brand: item.product.brand || '',
        description: item.product.description || ''
      };
    }
    
    return {
      isUserDesigned: false,
      category: '',
      subCategory: '',
      brand: '',
      description: ''
    };
  };

  const resolveImageUrl = (path, fallback = FALLBACK_THUMBNAIL) => {
    if (!path) return fallback;

    const rawPath = String(path).trim();
    if (!rawPath) return fallback;
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

  const handleImageError = (event) => {
    if (!event?.target) return;
    event.target.onerror = null;
    event.target.src = FALLBACK_THUMBNAIL;
  };

  const getItemImage = (item) => {
    if (item.previewImage) {
      return resolveImageUrl(item.previewImage);
    }

    if (item.kind === "READYMADE" && item.readymadeProduct) {
      if (item.readymadeProduct.thumbnail) {
        return resolveImageUrl(item.readymadeProduct.thumbnail);
      }
      if (item.readymadeProduct.images && item.readymadeProduct.images.length > 0) {
        return resolveImageUrl(item.readymadeProduct.images[0]);
      }
    } else if (item.kind === "DESIGN" && item.design) {
      if (item.design.previewImage) {
        return resolveImageUrl(item.design.previewImage);
      }
      if (item.design.thumbnail) {
        return resolveImageUrl(item.design.thumbnail);
      }
      if (item.design.views && item.design.views.length > 0) {
        return resolveImageUrl(item.design.views[0]?.previewImage);
      }
    } else if (item.dropproduct) {
      if (item.dropproduct.thumbnail) {
        return resolveImageUrl(item.dropproduct.thumbnail);
      }
      if (item.dropproduct.images && item.dropproduct.images.length > 0) {
        return resolveImageUrl(item.dropproduct.images[0]);
      }
    } else if (item.product) {
      if (item.product.thumbnail) {
        return resolveImageUrl(item.product.thumbnail);
      }
      if (item.product.images && item.product.images.length > 0) {
        return resolveImageUrl(item.product.images[0]);
      }
    }

    return FALLBACK_THUMBNAIL;
  };

  const getFullImageUrl = (path) => resolveImageUrl(path);

  const getOrderStatusProgress = (orderStatus) => {
    const statusOrder = ['PROCESSING', 'READY', 'SHIPPED', 'DELIVERED'];
    const currentIndex = statusOrder.indexOf(orderStatus);
    return {
      processing: currentIndex >= 0,
      ready: currentIndex >= 1,
      shipped: currentIndex >= 2,
      delivered: currentIndex >= 3
    };
  };

  const getCancellationNote = (order) => {
    if (!order || order.status !== 'CANCELLED') return null;
    return 'This order was cancelled before it reached ready status.';
  };

  const getReturnStatusInfo = (order) => {
    const status = order?.returnRequest?.status || 'NONE';

    if (status === 'PROCESSING') {
      return {
        tone: 'amber',
        message: 'Return request is processing and waiting for admin approval.',
      };
    }

    if (status === 'APPROVED') {
      if (order?.returnRequest?.refundStatus === 'PAID') {
        return {
          tone: 'emerald',
          message: order?.returnRequest?.refundPaidAt
            ? `Refund paid on ${formatDate(order.returnRequest.refundPaidAt)}.`
            : 'Refund paid successfully.',
        };
      }

      return {
        tone: 'emerald',
        message: 'Return approved. Please keep the shipment ready for pickup. Refund will be initiated after warehouse inspection (3-5 business days).',
      };
    }

    if (status === 'REJECTED') {
      return {
        tone: 'rose',
        message: order?.returnRequest?.adminDecisionNote || 'Return request was rejected by admin.',
      };
    }

    if (order?.returnRestrictedReason) {
      return {
        tone: 'amber',
        message: order.returnRestrictedReason,
      };
    }

    if (order?.returnEligible && order?.returnDeadlineAt) {
      return {
        tone: 'blue',
        message: `Return available until ${formatDate(order.returnDeadlineAt)}.`,
      };
    }

    return null;
  };

  const getReturnAdminNote = (order) => {
    const note = order?.returnRequest?.adminDecisionNote;
    return typeof note === 'string' && note.trim() ? note.trim() : null;
  };

  const getReturnToneClasses = (tone) => {
    switch (tone) {
      case 'emerald':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'rose':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'amber':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-700';
    }
  };

  const getItemDetailsPath = (item) => {
    if (!item) return null;

    if (item.kind === 'READYMADE') {
      const readymadePath = buildReadymadeProductPath(item.readymadeProduct || item.product || item);
      if (readymadePath) return readymadePath;
      const readymadeId =
        item.readymadeProduct?._id ||
        item.readymadeProduct ||
        item.product?._id ||
        item.product;
      return readymadeId ? `/readymade/${readymadeId}` : null;
    }

    if (item.kind === 'DROPPRODUCT') {
      return buildDropProductPath(item.dropproduct || item);
    }

    if (item.kind === 'DESIGN') {
      const designId = item.design?._id || item.design;
      if (designId) {
        return `/catalogue/${designId}`;
      }

      const productSlug =
        item.design?.productSlug ||
        item.product?.slug ||
        item.design?.product?.slug;
      return productSlug ? `/products/${productSlug}/customize` : null;
    }

    return null;
  };

  const handleOpenItemDetails = (item) => {
    const detailsPath = getItemDetailsPath(item);
    if (detailsPath) {
      navigate(detailsPath);
    }
  };

  const cancelConfirmOrder =
    (cancelConfirmOrderId && orders.find((order) => order._id === cancelConfirmOrderId)) ||
    (selectedOrder?._id === cancelConfirmOrderId ? selectedOrder : null);

  const returnModalOrder =
    (returnModalOrderId && orders.find((order) => order._id === returnModalOrderId)) ||
    (selectedOrder?._id === returnModalOrderId ? selectedOrder : null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading orders</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => dispatch(fetchMyPaidOrders())}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Invoice Download Error Toast */}
      {showInvoiceError && invoiceError && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Invoice Download Failed</h3>
                <p className="mt-1 text-sm text-red-700">{invoiceError}</p>
              </div>
              <button
                onClick={() => {
                  setShowInvoiceError(false);
                  dispatch(clearInvoiceError());
                }}
                className="ml-auto -mx-1.5 -my-1.5 bg-red-50 text-red-500 rounded-lg focus:ring-2 focus:ring-red-400 p-1.5 hover:bg-red-100 inline-flex h-8 w-8"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">View and track your purchase history</p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.2 6.5 10.266a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            Showing paid, cash on delivery, and cancelled orders
          </div>
        </div>

        {cancelSuccessMessage ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {cancelSuccessMessage}
          </div>
        ) : null}

        {returnSuccessMessage ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {returnSuccessMessage}
          </div>
        ) : null}

        {cancelOrderError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cancelOrderError}
          </div>
        ) : null}

        {submitReturnError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitReturnError}
          </div>
        ) : null}

        {/* Orders List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {!orders || orders.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
              <p className="mt-1 text-sm text-gray-500">Start shopping to see your orders here.</p>
              <div className="mt-6">
                <button
                  onClick={() => window.location.href = '/products'}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Browse Products
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {orders.map((order) => {
                const progress = getOrderStatusProgress(order.orderStatus);
                const isDownloadingThisInvoice = downloadingOrderId === order._id;
                const reviewableItems = (order.items || []).filter((item) => item.reviewMeta?.reviewable);
                const reviewedItemsCount = (order.items || []).filter((item) => item.reviewMeta?.existingReview).length;
                const reviewTargetItem =
                  reviewableItems.find((item) => !item.reviewMeta?.existingReview) ||
                  reviewableItems[0] ||
                  null;
                const pendingReviewKinds = (order.items || []).some((item) => item.reviewMeta?.kind);
                const isCancellingThisOrder = cancellingOrderId === order._id && cancelOrderLoading;
                const isSubmittingReturnThisOrder = returnSubmittingOrderId === order._id && submitReturnLoading;
                const cancellationNote = getCancellationNote(order);
                const returnStatusInfo = getReturnStatusInfo(order);
                const returnAdminNote = getReturnAdminNote(order);
                return (
                  <li key={order._id} className="p-6 hover:bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              Order #{order._id.slice(-8).toUpperCase()}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Placed on {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Order Progress */}
                        <div className="mt-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${progress.processing ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.ready ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.ready ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.shipped ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.shipped ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`flex-1 h-1 mx-2 ${progress.delivered ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <div className={`w-3 h-3 rounded-full ${progress.delivered ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Processing</span>
                            <span>Ready</span>
                            <span>Shipped</span>
                            <span>Delivered</span>
                          </div>
                          {cancellationNote ? (
                            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                              {cancellationNote}
                            </div>
                          ) : null}
                          {returnStatusInfo ? (
                            <div className={`mt-3 rounded-md border px-3 py-2 text-xs font-medium ${getReturnToneClasses(returnStatusInfo.tone)}`}>
                              {returnStatusInfo.message}
                            </div>
                          ) : null}
                          {returnAdminNote ? (
                            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Admin Note
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {returnAdminNote}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Delivery Address</h4>
                            {order.deliveryAddress ? (
                              <div className="text-sm text-gray-600">
                                <p className="font-medium">{order.deliveryAddress.fullName}</p>
                                <p className="mt-1">{order.deliveryAddress.completeAddress}</p>
                                <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.pincode}</p>
                                <p className="mt-1">Phone: {order.deliveryAddress.mobileNumber}</p>
                                {order.deliveryAddress.landmark && (
                                  <p className="text-xs text-gray-500">Landmark: {order.deliveryAddress.landmark}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">Not specified</p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Order Items ({order.items?.length || 0})</h4>
                            <div className="space-y-3">
                              {order.items?.map((item, index) => {
                                const productDetails = getProductDetails(item);
                                return (
                                  <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                    <div className="flex items-start space-x-3">
                                    <img
                                      src={getItemImage(item)}
                                      alt={getItemName(item)}
                                      className={`h-12 w-12 object-cover rounded ${getItemDetailsPath(item) ? 'cursor-pointer' : ''}`}
                                      onClick={() => handleOpenItemDetails(item)}
                                      onError={(e) => {
                                        handleImageError(e);
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {getItemName(item)}
                                      </p>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                          {getItemType(item)}
                                        </span>
                                        {productDetails.isUserDesigned && (
                                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                            Custom Design
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {item.qty} × ₹{item.unitPrice?.toFixed(2)} = ₹{(item.unitPrice * item.qty).toFixed(2)}
                                      </p>
                                      {item.size && (
                                        <p className="text-xs text-gray-500">Size: {item.size}</p>
                                      )}
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {item.reviewMeta?.existingReview ? (
                                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                            Reviewed {item.reviewMeta.existingReview.rating}/5
                                          </span>
                                        ) : null}
                                        {item.reviewMeta?.reviewable ? (
                                          <button
                                            type="button"
                                            onClick={() => openReviewModal(order._id, item)}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                          >
                                            {item.reviewMeta?.existingReview ? 'Edit Review' : 'Write Review'}
                                          </button>
                                        ) : item.reviewMeta?.kind ? (
                                          <span className="text-xs text-gray-500">
                                            Review available after delivery
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Summary</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="text-gray-900">₹{order.subtotal?.toFixed(2) || calculateTotal(order)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shipping:</span>
                                <span className="text-gray-900">₹0.00</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                                <span className="font-medium text-gray-900">Total:</span>
                                <span className="text-xl font-bold text-gray-900">₹{order.total?.toFixed(2) || calculateTotal(order)}</span>
                              </div>
                              {order.payment?.razorpayPaymentId && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Payment ID: {order.payment.razorpayPaymentId.slice(-8)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 md:mt-0 md:ml-6 flex flex-col space-y-3">
                        <button
                          onClick={() => handleViewDetails(order._id)}
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        {canCancelOrder(order) ? (
                          <button
                            type="button"
                            onClick={() => openCancelConfirm(order._id)}
                            disabled={isCancellingThisOrder}
                            className={`inline-flex items-center justify-center px-4 py-2 border text-sm font-semibold rounded-md shadow-sm ${
                              isCancellingThisOrder
                                ? 'cursor-not-allowed border-rose-100 bg-rose-50 text-rose-300'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-400'
                            }`}
                          >
                            {isCancellingThisOrder ? 'Cancelling...' : 'Cancel Order'}
                          </button>
                        ) : null}
                        {canReturnOrder(order) ? (
                          <button
                            type="button"
                            onClick={() => openReturnModal(order._id)}
                            disabled={isSubmittingReturnThisOrder}
                            className={`inline-flex items-center justify-center px-4 py-2 border text-sm font-semibold rounded-md shadow-sm ${
                              isSubmittingReturnThisOrder
                                ? 'cursor-not-allowed border-sky-100 bg-sky-50 text-sky-300'
                                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400'
                            }`}
                          >
                            {isSubmittingReturnThisOrder ? 'Submitting Return...' : 'Return Order'}
                          </button>
                        ) : null}
                        {needsReturnSupport(order) ? (
                          <a
                            href="/contact"
                            className="inline-flex items-center justify-center px-4 py-2 border border-amber-200 text-sm font-semibold rounded-md shadow-sm text-amber-900 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                          >
                            Contact Support Team
                          </a>
                        ) : null}
                        {reviewTargetItem ? (
                          <button
                            type="button"
                            onClick={() => openReviewModal(order._id, reviewTargetItem)}
                            className="inline-flex items-center justify-center px-4 py-2 border border-amber-200 text-sm font-semibold rounded-md shadow-sm text-amber-900 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                          >
                            {reviewableItems.length > 1
                              ? `Review Products (${reviewedItemsCount}/${reviewableItems.length})`
                              : reviewTargetItem.reviewMeta?.existingReview
                              ? 'Edit Review'
                              : 'Write Review'}
                          </button>
                        ) : pendingReviewKinds ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs font-medium text-slate-600">
                            Review available after delivery
                          </div>
                        ) : null}
                        {order.payment?.razorpayPaymentId && (
                          <button
                            onClick={() => handleDownloadInvoice(order._id)}
                            disabled={invoiceLoading && isDownloadingThisInvoice}
                            className={`inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                              invoiceLoading && isDownloadingThisInvoice
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                            }`}
                          >
                            {invoiceLoading && isDownloadingThisInvoice ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                                Downloading...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download Invoice
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Order Details #{selectedOrder?._id?.slice(-8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Placed on {formatDate(selectedOrder?.createdAt)}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {selectedOrderLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : selectedOrder ? (
                <div className="space-y-8">
                  {(() => {
                    const returnStatusInfo = getReturnStatusInfo(selectedOrder);
                    const returnAdminNote = getReturnAdminNote(selectedOrder);

                    return (
                      <div className="bg-gray-50 rounded-lg p-6">
                    {getCancellationNote(selectedOrder) ? (
                      <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {getCancellationNote(selectedOrder)}
                      </div>
                    ) : null}
                    {returnStatusInfo ? (
                      <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${getReturnToneClasses(returnStatusInfo.tone)}`}>
                        {returnStatusInfo.message}
                      </div>
                    ) : null}
                    {returnAdminNote ? (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Admin Note
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {returnAdminNote}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">Order Status</h4>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedOrder.orderStatus)}`}>
                            {selectedOrder.orderStatus}
                          </span>
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getPaymentStatusColor(getDisplayPaymentStatus(selectedOrder))}`}>
                            {getDisplayPaymentStatus(selectedOrder).replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Last updated: {formatDate(selectedOrder.updatedAt)}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-6">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'PROCESSING' || selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'READY' || selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'SHIPPED' || selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`flex-1 h-2 mx-4 ${selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${selectedOrder.orderStatus === 'DELIVERED' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <div className="text-center">
                          <div className="font-medium">Processing</div>
                          <div className="text-xs">Order confirmed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Ready</div>
                          <div className="text-xs">Preparing to ship</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Shipped</div>
                          <div className="text-xs">On the way</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Delivered</div>
                          <div className="text-xs">Order received</div>
                        </div>
                      </div>
                    </div>
                      </div>
                    );
                  })()}

                  {/* Order Items */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Order Items ({selectedOrder.items?.length || 0})</h4>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="divide-y divide-gray-200">
                        {selectedOrder.items?.map((item, index) => {
                          const productDetails = getProductDetails(item);
                          return (
                            <div key={index} className="p-4">
                              <div className="flex items-start space-x-4">
                                <img
                                  src={getItemImage(item)}
                                  alt={getItemName(item)}
                                  className={`h-20 w-20 object-cover rounded-lg ${getItemDetailsPath(item) ? 'cursor-pointer' : ''}`}
                                  onClick={() => handleOpenItemDetails(item)}
                                  onError={(e) => {
                                    handleImageError(e);
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex justify-between">
                                    <div>
                                      <h5 className="text-sm font-medium text-gray-900">
                                        {getItemName(item)}
                                      </h5>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                          {getItemType(item)}
                                        </span>
                                        {productDetails.isUserDesigned && (
                                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                            Your Custom Design
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-2">
                                        Type: {item.kind}
                                        {item.size && ` • Size: ${item.size}`}
                                        {item.signature && ` • Signature: ${item.signature}`}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-gray-900">
                                        ₹{(item.unitPrice * item.qty).toFixed(2)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {item.qty} × ₹{item.unitPrice?.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Product Details */}
                                  <div className="mt-3">
                                    {productDetails.category && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {productDetails.isUserDesigned ? (
                                          <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs font-medium text-purple-700">Custom Design Created by You</span>
                                          </div>
                                        ) : (
                                          <>
                                            {productDetails.category && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                                </svg>
                                                {productDetails.category}
                                              </span>
                                            )}
                                            {productDetails.subCategory && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                </svg>
                                                {productDetails.subCategory}
                                              </span>
                                            )}
                                            {productDetails.brand && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                                {productDetails.brand}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                    {productDetails.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {productDetails.description}
                                      </p>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {item.reviewMeta?.existingReview ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                          Reviewed {item.reviewMeta.existingReview.rating}/5
                                        </span>
                                      ) : null}
                                      {item.reviewMeta?.reviewable ? (
                                        <button
                                          type="button"
                                          onClick={() => openReviewModal(selectedOrder._id, item)}
                                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                        >
                                          {item.reviewMeta?.existingReview ? 'Edit Review' : 'Write Review'}
                                        </button>
                                      ) : selectedOrder.orderStatus !== 'DELIVERED' && item.reviewMeta?.kind ? (
                                        <span className="text-xs text-gray-500">
                                          Review available after delivery
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Address Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Delivery Address</h4>
                      {selectedOrder.deliveryAddress ? (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">{selectedOrder.deliveryAddress.fullName}</p>
                          <p className="mt-2">{selectedOrder.deliveryAddress.completeAddress}</p>
                          <p className="mt-1">
                            {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} {selectedOrder.deliveryAddress.pincode}
                          </p>
                          <div className="mt-3 space-y-1">
                            <p className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                              </svg>
                              {selectedOrder.deliveryAddress.mobileNumber}
                            </p>
                            {selectedOrder.deliveryAddress.landmark && (
                              <p className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                {selectedOrder.deliveryAddress.landmark}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No delivery address specified</p>
                      )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Billing Address</h4>
                      {selectedOrder.billingAddress ? (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">{selectedOrder.billingAddress.fullName}</p>
                          <p className="mt-2">{selectedOrder.billingAddress.completeAddress}</p>
                          <p className="mt-1">
                            {selectedOrder.billingAddress.city}, {selectedOrder.billingAddress.state} {selectedOrder.billingAddress.pincode}
                          </p>
                          <div className="mt-3 space-y-1">
                            <p className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                              </svg>
                              {selectedOrder.billingAddress.mobileNumber}
                            </p>
                            {selectedOrder.billingAddress.landmark && (
                              <p className="flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                {selectedOrder.billingAddress.landmark}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Same as delivery address</p>
                      )}
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">₹{selectedOrder.subtotal?.toFixed(2) || calculateTotal(selectedOrder)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="text-gray-900">₹0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900">₹0.00</span>
                      </div>
                      <div className="border-t border-gray-300 pt-3">
                        <div className="flex justify-between">
                          <span className="text-lg font-medium text-gray-900">Total</span>
                          <span className="text-2xl font-bold text-gray-900">₹{selectedOrder.total?.toFixed(2) || calculateTotal(selectedOrder)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {selectedOrder.payment && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Payment Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600">Payment Method</p>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {selectedOrder.payment?.method === 'COD' ? 'Cash on Delivery' : 'Razorpay'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Payment Status</p>
                          <p className={`mt-1 text-sm font-semibold ${selectedOrder.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {selectedOrder.payment.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Currency</p>
                          <p className="mt-1 text-sm font-medium text-gray-900">{selectedOrder.currency}</p>
                        </div>
                        {selectedOrder.payment.razorpayPaymentId && (
                          <div>
                            <p className="text-sm text-gray-600">Payment ID</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                              {selectedOrder.payment.razorpayPaymentId}
                            </p>
                          </div>
                        )}
                        {selectedOrder.payment.razorpayOrderId && (
                          <div>
                            <p className="text-sm text-gray-600">Order ID</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                              {selectedOrder.payment.razorpayOrderId}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Order not found</h3>
                  <p className="mt-1 text-sm text-gray-500">Unable to load order details.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">
                    Need help with this order? <a href="/contact" className="text-indigo-600 hover:text-indigo-500">Contact Support</a>
                  </p>
                </div>
                <div className="flex space-x-3">
                  {canCancelOrder(selectedOrder) ? (
                    <button
                      type="button"
                      onClick={() => openCancelConfirm(selectedOrder._id)}
                      disabled={cancelOrderLoading && cancellingOrderId === selectedOrder._id}
                      className={`inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                        cancelOrderLoading && cancellingOrderId === selectedOrder._id
                          ? 'cursor-not-allowed border-rose-100 bg-rose-50 text-rose-300'
                          : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-400'
                      }`}
                    >
                      {cancelOrderLoading && cancellingOrderId === selectedOrder._id ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  ) : null}
                  {canReturnOrder(selectedOrder) ? (
                    <button
                      type="button"
                      onClick={() => openReturnModal(selectedOrder._id)}
                      disabled={submitReturnLoading && returnSubmittingOrderId === selectedOrder._id}
                      className={`inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                        submitReturnLoading && returnSubmittingOrderId === selectedOrder._id
                          ? 'cursor-not-allowed border-sky-100 bg-sky-50 text-sky-300'
                          : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400'
                      }`}
                    >
                      {submitReturnLoading && returnSubmittingOrderId === selectedOrder._id ? 'Submitting Return...' : 'Return Order'}
                    </button>
                  ) : null}
                  {needsReturnSupport(selectedOrder) ? (
                    <a
                      href="/contact"
                      className="inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                    >
                      Contact Support Team
                    </a>
                  ) : null}
                  {selectedOrder?.payment?.razorpayPaymentId && (
                    <button
                      onClick={() => handleDownloadInvoice(selectedOrder._id)}
                      disabled={invoiceLoading && downloadingOrderId === selectedOrder._id}
                      className={`inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium ${
                        invoiceLoading && downloadingOrderId === selectedOrder._id
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                      }`}
                    >
                      {invoiceLoading && downloadingOrderId === selectedOrder._id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                          Downloading Invoice...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Invoice
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelConfirmOrder ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel this order?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will cancel order #{cancelConfirmOrder._id.slice(-8).toUpperCase()} immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCancelConfirm}
                disabled={cancelOrderLoading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => handleCancelOrder(cancelConfirmOrder._id)}
                disabled={cancelOrderLoading}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  cancelOrderLoading
                    ? 'cursor-not-allowed bg-rose-300'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {cancelOrderLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {returnModalOrder ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Request Return</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Upload proof images, explain the issue, and provide refund bank or UPI details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReturnModal}
                  disabled={submitReturnLoading}
                  className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Return deadline: {formatDate(returnModalOrder.returnDeadlineAt)}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Reason for return</label>
                <textarea
                  name="reason"
                  value={returnForm.reason}
                  onChange={handleReturnInputChange}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder="Describe the issue with the order"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Upload images</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  onChange={handleReturnImagesChange}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="mt-2 text-xs text-slate-500">Upload up to 5 images.</p>
                {returnForm.images.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {returnForm.images.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="rounded-full bg-slate-100 px-3 py-1">
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Refund method</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setReturnForm((prev) => ({ ...prev, method: 'UPI' }))}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      returnForm.method === 'UPI'
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnForm((prev) => ({ ...prev, method: 'BANK' }))}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      returnForm.method === 'BANK'
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Bank
                  </button>
                </div>
              </div>

              {returnForm.method === 'UPI' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">UPI ID</label>
                  <input
                    type="text"
                    name="upiId"
                    value={returnForm.upiId}
                    onChange={handleReturnInputChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="example@upi"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Account Holder Name</label>
                    <input
                      type="text"
                      name="accountHolderName"
                      value={returnForm.accountHolderName}
                      onChange={handleReturnInputChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Account Number</label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={returnForm.accountNumber}
                      onChange={handleReturnInputChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">IFSC Code</label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={returnForm.ifscCode}
                      onChange={handleReturnInputChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Bank Name</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBankDropdown((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        {selectedBankOption ? (
                          <span className="flex items-center gap-3">
                            <BankLogoMark option={selectedBankOption} />
                            <span>{selectedBankOption.label}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Select bank</span>
                        )}
                        <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showBankDropdown ? (
                        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                          {BANK_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setReturnForm((prev) => ({ ...prev, bankName: option.value }));
                                setShowBankDropdown(false);
                              }}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                                returnForm.bankName === option.value ? 'bg-sky-50 text-sky-700' : 'text-slate-700'
                              }`}
                            >
                              <BankLogoMark option={option} />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">Branch Name</label>
                    <input
                      type="text"
                      name="branchName"
                      value={returnForm.branchName}
                      onChange={handleReturnInputChange}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeReturnModal}
                disabled={submitReturnLoading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSubmitReturnRequest(returnModalOrder._id)}
                disabled={submitReturnLoading || !isReturnFormValid()}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  submitReturnLoading || !isReturnFormValid()
                    ? 'cursor-not-allowed bg-sky-300'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {submitReturnLoading ? 'Submitting...' : 'Submit Return Request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ReviewModal
        isOpen={reviewModalState.isOpen}
        onClose={closeReviewModal}
        item={reviewModalState.item}
        orderId={reviewModalState.orderId}
        token={token}
        productName={reviewModalState.productName}
        onSubmitted={handleReviewSubmitted}
      />
    </div>
  );
};

export default UserOrders;
