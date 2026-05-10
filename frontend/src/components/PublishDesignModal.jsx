import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchCategories,
  fetchSubCategories
} from "../redux/slices/category.js";

import {
  fetchBrandsBySubCategory,
  clearBrands
} from "../redux/slices/brandSlice.js";

import { X, ChevronRight, ChevronLeft } from "lucide-react";

const PublishDesignModal = ({ isOpen, onClose, design }) => {

  const dispatch = useDispatch();

  const API_BASE = import.meta.env.VITE_API_URL;

  //--------------------------------------------------
  // Redux state
  //--------------------------------------------------

  const { categories, subCategories } = useSelector(
    state => state.category
  );

  const { brands } = useSelector(
    state => state.brand
  );

  //--------------------------------------------------
  // Component state
  //--------------------------------------------------

  const [loading, setLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);

  const [filteredSubCategories, setFilteredSubCategories] = useState([]);

  const [filteredBrands, setFilteredBrands] = useState([]);

  const [formData, setFormData] = useState({

    category: "",
    subCategory: "",
    brand: "",

    productName: "",
    description: "",

    priceBreakdown: {
      basePrice: 0,
      pricingMode: "fixed-image",
      designLayers: []
    }

  });

  //--------------------------------------------------
  // Load categories
  //--------------------------------------------------

  useEffect(() => {

    if (!isOpen) return;

    dispatch(fetchCategories());
    dispatch(fetchSubCategories());

    return () => dispatch(clearBrands());

  }, [isOpen]);

  //--------------------------------------------------
  // Load existing design
  //--------------------------------------------------

  useEffect(() => {

    if (!design) return;

    setFormData({

      category: design.category || "",
      subCategory: design.subCategory || "",
      brand: design.brand || "",

      productName: design.title || "",
      description: design.description || "",

      priceBreakdown: design.priceBreakdown || {
        basePrice: 0,
        pricingMode: "fixed-image",
        designLayers: []
      }

    });

  }, [design]);

  //--------------------------------------------------
  // Filter subcategories
  //--------------------------------------------------

  useEffect(() => {

    if (!formData.category) return;

    const filtered = subCategories.filter(
      s => String(s.category) === String(formData.category)
    );

    setFilteredSubCategories(filtered);

  }, [formData.category, subCategories]);

  //--------------------------------------------------
  // Load brands
  //--------------------------------------------------

  useEffect(() => {

    if (!formData.subCategory) return;

    dispatch(fetchBrandsBySubCategory(formData.subCategory));

  }, [formData.subCategory]);

  //--------------------------------------------------
  // Filter brands
  //--------------------------------------------------

  useEffect(() => {

    const filtered = brands.filter(
      b => String(b.subCategory) === String(formData.subCategory)
    );

    setFilteredBrands(filtered);

  }, [brands]);

  //--------------------------------------------------
  // Handlers
  //--------------------------------------------------

  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

  };

  //--------------------------------------------------
  // Price breakdown edit
  //--------------------------------------------------

  const updateBasePrice = (value) => {

    setFormData(prev => ({
      ...prev,
      priceBreakdown: {
        ...prev.priceBreakdown,
        basePrice: Number(value)
      }
    }));

  };

  const updateLayerPrice = (index, value) => {

    const updatedLayers = [...formData.priceBreakdown.designLayers];

    updatedLayers[index].price = Number(value);

    setFormData(prev => ({
      ...prev,
      priceBreakdown: {
        ...prev.priceBreakdown,
        designLayers: updatedLayers
      }
    }));

  };

  //--------------------------------------------------
  // Publish using fetch
  //--------------------------------------------------

const handlePublish = async () => {

  try {

    setLoading(true);

    const payload = {

      title: formData.productName,
      description: formData.description,

      category: formData.category,
      subCategory: formData.subCategory,
      brand: formData.brand,

      priceBreakdown: formData.priceBreakdown

    };

    const response = await fetch(
      `${API_BASE}/savedata/${design._id}/publish`,   // ✅ ID in URL
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok)
      throw new Error(result.message || "Publish failed");

    alert("Design published successfully ✅");

    onClose();

  }
  catch (error) {

    alert(error.message);

  }
  finally {

    setLoading(false);

  }

};


  //--------------------------------------------------

  if (!isOpen) return null;

  //--------------------------------------------------

  return (

    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">

      <div className="bg-white w-full max-w-3xl rounded-lg p-6">

        {/* Header */}

        <div className="flex justify-between items-center mb-4">

          <h2 className="text-xl font-bold">
            Publish Design
          </h2>

          <button onClick={onClose}>
            <X />
          </button>

        </div>

        {/* Step 1 */}

        {currentStep === 1 && (

          <div>

            <h3 className="font-semibold mb-2">
              Select Category
            </h3>

            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full border p-2 mb-3"
            >
              <option value="">Select Category</option>

              {categories.map(cat => (

                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>

              ))}

            </select>

            <button
              onClick={() => setCurrentStep(2)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Next
            </button>

          </div>

        )}

        {/* Step 2 */}

        {currentStep === 2 && (

          <div>

            <h3>Select SubCategory</h3>

            <select
              name="subCategory"
              value={formData.subCategory}
              onChange={handleChange}
              className="w-full border p-2 mb-3"
            >
              <option value="">Select SubCategory</option>

              {filteredSubCategories.map(sub => (

                <option key={sub._id} value={sub._id}>
                  {sub.name}
                </option>

              ))}

            </select>

            <button onClick={() => setCurrentStep(1)}>
              Back
            </button>

            <button
              onClick={() => setCurrentStep(3)}
              className="bg-blue-600 text-white px-4 py-2 rounded ml-2"
            >
              Next
            </button>

          </div>

        )}

        {/* Step 3 */}

        {currentStep === 3 && (

          <div>

            <h3>Select Brand</h3>

            <select
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              className="w-full border p-2 mb-3"
            >
              <option value="">Select Brand</option>

              {filteredBrands.map(brand => (

                <option key={brand._id} value={brand._id}>
                  {brand.name}
                </option>

              ))}

            </select>

            <button onClick={() => setCurrentStep(2)}>
              Back
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              className="bg-blue-600 text-white px-4 py-2 rounded ml-2"
            >
              Next
            </button>

          </div>

        )}

        {/* Step 4 */}

        {currentStep === 4 && (

          <div>

            <input
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder="Product Name"
              className="w-full border p-2 mb-3"
            />

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Description"
              className="w-full border p-2 mb-3"
            />

            <input
              type="number"
              value={formData.priceBreakdown.basePrice}
              onChange={(e) =>
                updateBasePrice(e.target.value)
              }
              className="w-full border p-2 mb-3"
            />

            {formData.priceBreakdown.designLayers.map((layer, index) => (

              <div key={index}>

                <label>{layer.zone}</label>

                <input
                  type="number"
                  value={layer.price}
                  onChange={(e) =>
                    updateLayerPrice(index, e.target.value)
                  }
                  className="w-full border p-2 mb-2"
                />

              </div>

            ))}

            <button onClick={() => setCurrentStep(3)}>
              Back
            </button>

            <button
              onClick={handlePublish}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 ml-2 rounded"
            >
              {loading ? "Publishing..." : "Publish"}
            </button>

          </div>

        )}

      </div>

    </div>

  );

};

export default PublishDesignModal;
