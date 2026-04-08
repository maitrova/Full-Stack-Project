import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";

const PRINT_ZONE_DEFAULTS = {
  front: "front-full",
  back: "back-full",
  right: "sleeve-right",
  left: "sleeve-left",
};
const normalizeZone = (z, fallbackZone) => {
  if (!z) return fallbackZone || "front-full";

  const zone = String(z).trim().toLowerCase();

  // ✅ map all pocket variants to ONE zone name
  if (
    zone === "pocket" ||
    zone === "front-pocket" ||
    zone === "front_pocket" ||
    zone === "pocket-front" ||
    zone.includes("pocket")
  ) {
    return "front-pocket"; // <-- pick ONE canonical name
  }

  // allow known zones
  const allowed = new Set([
    "front-full",
    "back-full",
    "sleeve-left",
    "sleeve-right",
    "front-pocket", // ✅ include it
  ]);

  return allowed.has(zone) ? zone : (fallbackZone || "front-full");
};

const PRINT_DPI = 300; // 300 DPI for print quality
const DEFAULT_IMAGE_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];
const DEFAULT_TEXT_PRICE_RULES = [
  { maxSideInches: 4, price: 40 },
  { maxSideInches: null, price: 100 },
];

const normalizeImagePriceRules = (rules = DEFAULT_IMAGE_PRICE_RULES) => {
  const source = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_IMAGE_PRICE_RULES;
  return source
    .map((entry) => {
      const rawMax = entry?.maxSideInches;
      const hasFiniteMax =
        rawMax !== null &&
        rawMax !== undefined &&
        String(rawMax).trim() !== "";
      const maxSideInches = hasFiniteMax ? Number(rawMax) : null;
      const price = Number(entry?.price || 0);

      if (hasFiniteMax && (!Number.isFinite(maxSideInches) || maxSideInches < 0)) {
        return null;
      }

      if (!Number.isFinite(price) || price < 0) {
        return null;
      }

      return { maxSideInches, price };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.maxSideInches === null) return 1;
      if (b.maxSideInches === null) return -1;
      return a.maxSideInches - b.maxSideInches;
    });
};

const resolveImagePriceRule = (widthInches, heightInches, rules = DEFAULT_IMAGE_PRICE_RULES) => {
  const largestSide = Math.max(Number(widthInches || 0), Number(heightInches || 0));
  if (!largestSide) return null;

  const normalizedRules = normalizeImagePriceRules(rules);
  return (
    normalizedRules.find(
      (rule) => rule.maxSideInches === null || largestSide <= rule.maxSideInches
    ) || normalizedRules[normalizedRules.length - 1] || null
  );
};
const MINIMUM_DESIGN_CHARGE = 0; // Minimum ₹30 for any design up to 4x4 inches
const getSizeBasePrice = (product, selectedSize) => {
  const list = product?.sizePricing || [];
  if (!selectedSize) return Number(product?.basePrice ?? 600);

  const found = list.find(
    (x) => String(x.size).toUpperCase() === String(selectedSize).toUpperCase()
  );

  return Number(found?.price ?? product?.basePrice ?? 600);
};

// Helper function to calculate inches from pixels
const pixelsToInches = (pixels) => pixels / PRINT_DPI;

// Helper function to calculate text area (approximation)
const calculateTextAreaInches = (fontSize, text = "") => {
  // Approximate based on font size and text length
  const fontSizeInches = fontSize / PRINT_DPI;
  const avgChars = text.length || 5;
  // Approx character width = 0.6 * font size, height = 1.2 * font size
  const widthInches = fontSizeInches * 0.6 * avgChars;
  const heightInches = fontSizeInches * 1.2;
  return widthInches * heightInches;
};

const getTextLayerMeasurements = (textLayer = {}) => {
  const widthInches = Number(textLayer.renderedWidthInches ?? textLayer.widthInches ?? 0) || 0;
  const heightInches = Number(textLayer.renderedHeightInches ?? textLayer.heightInches ?? 0) || 0;

  if (widthInches > 0 && heightInches > 0) {
    return {
      widthInches,
      heightInches,
      areaInches: widthInches * heightInches,
    };
  }

  const areaInches =
    Number(textLayer.areaInches ?? calculateTextAreaInches(textLayer.fontSize, textLayer.text)) || 0;

  if (!areaInches) {
    return { widthInches: 0, heightInches: 0, areaInches: 0 };
  }

  const fallbackSide = Math.sqrt(areaInches);
  return {
    widthInches: fallbackSide,
    heightInches: fallbackSide,
    areaInches,
  };
};

// Calculate price based on product's pricing mode
const calculateDesignPrice = (
  designLayers,
  textLayers,
  zones,
  product,
  basePriceOverride = null
) => {
  const basePrice = Number(basePriceOverride ?? product.basePrice ?? 600);
  let totalPrice = basePrice;

  const breakdown = {
    basePrice,
    pricingMode: "fixed-image",
    designLayers: [],
    textLayers: [],
    sleeves: { count: 0, total: 0 },
    minimumDesignCharges: 0,
    totalPrice: basePrice,
  };

  // ✅ FIXED IMAGE PRICING CONSTANTS
  const imagePriceRules = normalizeImagePriceRules(product?.normalPricing?.imagePriceRules);
  const textPriceRules = normalizeImagePriceRules(
    product?.normalPricing?.textPriceRules || product?.normalPricing?.imagePriceRules || DEFAULT_TEXT_PRICE_RULES
  );
  const SLEEVE_PRICE = product.normalPricing?.sleevePrice || 30;

  /* =========================
     IMAGE / DESIGN LAYERS
     ========================= */
  designLayers.forEach((layer) => {
    const zone = layer.zone || "front-full";

    // Sleeves (fixed)
    if (zone === "sleeve-left" || zone === "sleeve-right") {
      totalPrice += SLEEVE_PRICE;
      breakdown.sleeves.count += 1;
      breakdown.sleeves.total += SLEEVE_PRICE;

      breakdown.designLayers.push({
        id: layer.id,
        type: "sleeve",
        zone,
        price: SLEEVE_PRICE,
        note: "Sleeve fixed price",
      });
      return;
    }

    // ✅ IMAGE FIXED PRICE
    const widthIn =
      layer.renderedWidthInches ??
      layer.widthInches ??
      layer.currentPrintWidthInches ??
      0;

    const heightIn =
      layer.renderedHeightInches ??
      layer.heightInches ??
      layer.currentPrintHeightInches ??
      0;

    const matchedRule = resolveImagePriceRule(widthIn, heightIn, imagePriceRules);
    const layerPrice =
      Number(layer.layerPrice) ||
      Number(matchedRule?.price || 0);

    totalPrice += layerPrice;

    breakdown.designLayers.push({
      id: layer.id,
      type: "image",
      zone,
      widthInches: Number(widthIn).toFixed(2),
      heightInches: Number(heightIn).toFixed(2),
      price: layerPrice,
      minimumChargeApplied:
        matchedRule?.maxSideInches !== null &&
        Math.max(Number(widthIn || 0), Number(heightIn || 0)) <= Number(matchedRule?.maxSideInches || 0),
      pricingRule:
        matchedRule?.maxSideInches === null
          ? "Catch-all image rule"
          : `Up to ${matchedRule.maxSideInches}" max side`, 
    });
  });

  /* =========================
     TEXT LAYERS (UNCHANGED)
     ========================= */
  textLayers.forEach((textLayer) => {
    const zone = normalizeZone(textLayer.zone, "front-full");
    const { widthInches, heightInches, areaInches } = getTextLayerMeasurements(textLayer);

    if (!widthInches || !heightInches || !areaInches) return;

    const matchedRule = resolveImagePriceRule(widthInches, heightInches, textPriceRules);
    const textPrice = Number(textLayer.layerPrice) || Number(matchedRule?.price || 0);
    totalPrice += textPrice;

    breakdown.textLayers.push({
      id: textLayer.id,
      text: textLayer.text,
      zone,
      fontSize: textLayer.fontSize,
      widthInches: Number(widthInches).toFixed(2),
      heightInches: Number(heightInches).toFixed(2),
      areaInches: Number(areaInches).toFixed(2),
      price: textPrice,
      pricingRule:
        matchedRule?.maxSideInches === null
          ? "Catch-all text rule"
          : `Up to ${matchedRule.maxSideInches}" max side`,
    });
  });

  breakdown.totalPrice = totalPrice;
  return { totalPrice, breakdown };
};



const getLayerMeasurements = (layer) => {
  const rawPrintWidthInches = typeof layer.printWidthInches === "number"
    ? layer.printWidthInches
    : layer.originalWidthPx
      ? pixelsToInches(layer.originalWidthPx)
      : null;

  const rawPrintHeightInches = typeof layer.printHeightInches === "number"
    ? layer.printHeightInches
    : layer.originalHeightPx
      ? pixelsToInches(layer.originalHeightPx)
      : null;

  const fallbackScaledWidth = layer.renderedWidthPx ? pixelsToInches(layer.renderedWidthPx) : null;
  const fallbackScaledHeight = layer.renderedHeightPx ? pixelsToInches(layer.renderedHeightPx) : null;

  const scaledPrintWidthInches = typeof layer.currentPrintWidthInches === "number"
    ? layer.currentPrintWidthInches
    : rawPrintWidthInches && typeof layer.scale === "number"
      ? rawPrintWidthInches * layer.scale
      : fallbackScaledWidth ?? rawPrintWidthInches;

  const scaledPrintHeightInches = typeof layer.currentPrintHeightInches === "number"
    ? layer.currentPrintHeightInches
    : rawPrintHeightInches && typeof layer.scale === "number"
      ? rawPrintHeightInches * layer.scale
      : fallbackScaledHeight ?? rawPrintHeightInches;

  const widthInches = scaledPrintWidthInches ?? null;
  const heightInches = scaledPrintHeightInches ?? null;
  const areaInches = widthInches && heightInches ? widthInches * heightInches : null;
  const rawPrintAreaInches = rawPrintWidthInches && rawPrintHeightInches
    ? rawPrintWidthInches * rawPrintHeightInches
    : null;

  return {
    widthInches,
    heightInches,
    areaInches,
    rawPrintWidthInches,
    rawPrintHeightInches,
    rawPrintAreaInches,
  };
};





// Save design with price calculation
export const saveDesign = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const {
      productId,
      productSlug,
      productColor,
      productColorName,
      views = [],
      previewImage,
      selectedSize,
    } = req.body;

    if (!productId || !productSlug) {
      return res.status(400).json({ error: "productId and productSlug are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // ✅ helper: base price from sizePricing
    const getSizeBasePrice = (prod, size) => {
      const list = prod?.sizePricing || [];
      if (!size) return prod?.basePrice || 600;

      const found = list.find(
        (x) => String(x.size).toUpperCase() === String(size).toUpperCase()
      );

      return found?.price ?? prod?.basePrice ?? 600;
    };

    const basePriceBySize = getSizeBasePrice(product, selectedSize);

    const imagePriceRules = normalizeImagePriceRules(product?.normalPricing?.imagePriceRules);

    let totalDesignLayers = [];
    let totalTextLayers = [];
    let totalZones = [];

    const normalizedViews = views.map((view) => {
      const viewCode = view.code || "front";
      const defaultZone = PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

      const designLayers = (view.designLayers || []).map((layer) => {
        let imageUrl = layer.imageUrl;
        const apiUrl = process.env.API_URL || "https://maitrova.in/backend";
        if (imageUrl && imageUrl.includes(apiUrl)) {
          imageUrl = imageUrl.replace(apiUrl, "");
        }

        /**
         * ✅ IMPORTANT FIX:
         * Prefer inches coming from RecolorEditor:
         * - renderedWidthInches / renderedHeightInches
         * - OR currentPrintWidthInches / currentPrintHeightInches
         * - OR printWidthInches / printHeightInches
         *
         * Only if none exist, fallback to old getLayerMeasurements(layer).
         */
        let widthInches =
          layer.renderedWidthInches ??
          layer.currentPrintWidthInches ??
          layer.printWidthInches ??
          layer.widthInches;

        let heightInches =
          layer.renderedHeightInches ??
          layer.currentPrintHeightInches ??
          layer.printHeightInches ??
          layer.heightInches;

        let areaInches =
          layer.renderedAreaInches ??
          layer.currentPrintAreaInches ??
          layer.printAreaInches ??
          layer.areaInches;

        let rawPrintWidthInches = layer.rawPrintWidthInches ?? null;
        let rawPrintHeightInches = layer.rawPrintHeightInches ?? null;
        let rawPrintAreaInches = layer.rawPrintAreaInches ?? null;

        // fallback to old measurement function ONLY if still missing
        if (
          !Number(widthInches) ||
          !Number(heightInches)
        ) {
          const old = getLayerMeasurements(layer);
          widthInches = widthInches ?? old.widthInches;
          heightInches = heightInches ?? old.heightInches;
          areaInches = areaInches ?? old.areaInches;
          rawPrintWidthInches = rawPrintWidthInches ?? old.rawPrintWidthInches;
          rawPrintHeightInches = rawPrintHeightInches ?? old.rawPrintHeightInches;
          rawPrintAreaInches = rawPrintAreaInches ?? old.rawPrintAreaInches;
        }

        // ✅ normalize numbers
        widthInches = Number(widthInches || 0);
        heightInches = Number(heightInches || 0);
        areaInches = Number(areaInches || (widthInches * heightInches) || 0);

        // ✅ fixed price based on admin-managed image slab pricing
        const matchedRule = resolveImagePriceRule(widthInches, heightInches, imagePriceRules);
        const layerPrice = Number(matchedRule?.price || 0);
        const minimumChargeApplied = Boolean(
          matchedRule?.maxSideInches !== null &&
            widthInches <= Number(matchedRule?.maxSideInches || 0) &&
            heightInches <= Number(matchedRule?.maxSideInches || 0)
        );

        const processedLayer = {
          ...layer,
          imageUrl,
          zone: normalizeZone(layer.zone, defaultZone),

          insideSafeArea:
            typeof layer.insideSafeArea === "boolean" ? layer.insideSafeArea : true,

          // ✅ persist the EXACT inches from RecolorEditor
          widthInches,
          heightInches,
          areaInches,

          // keep these if you still want them
          rawPrintWidthInches,
          rawPrintHeightInches,
          rawPrintAreaInches,

          // ✅ persist fixed layer pricing
          layerPrice,
          minimumChargeApplied,
          priceRules: imagePriceRules,
        };

        totalDesignLayers.push(processedLayer);
        totalZones.push(processedLayer.zone);

        return processedLayer;
      });

      const textLayers = (view.textLayers || []).map((textLayer) => {
        const { widthInches, heightInches, areaInches } = getTextLayerMeasurements(textLayer);

        const processedTextLayer = {
          ...textLayer,
          zone: normalizeZone(textLayer.zone, defaultZone),
          widthInches,
          heightInches,
          areaInches,
        };

        totalTextLayers.push(processedTextLayer);
        return processedTextLayer;
      });

      return {
        ...view,
        designLayers,
        textLayers,
        previewImage: view.previewImage || null,
      };
    });

    // ✅ IMPORTANT:
    // If calculateDesignPrice() still does old area pricing,
    // then it will override again.
    // So we pass layers already having layerPrice,
    // and calculateDesignPrice must sum layer.layerPrice instead of area logic.
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones,
      product,
      basePriceBySize
    );

    let mainPreview = previewImage || null;
    if (!mainPreview && normalizedViews.length > 0) {
      const frontView = normalizedViews.find((v) => v.code === "front");
      mainPreview = frontView?.previewImage || normalizedViews[0]?.previewImage || null;
    }

    const design = await Design.create({
      user: req.user._id,
      product: product._id,
      productSlug,
      productName: product.name,
      productColor: productColor || "#FFFFFF",
      productColorName: productColorName || productColor || "White",
      previewImage: mainPreview,
      views: normalizedViews,

      selectedSize: selectedSize || null,
      basePrice: basePriceBySize,

      pricingMode: product.pricingMode || "normal",
      calculatedPrice: totalPrice,
      priceBreakdown: breakdown,
      salePrice: totalPrice,
    });

    return res.status(201).json(design);
  } catch (err) {
    console.error("Save design error:", err);
    return res.status(500).json({ error: "Failed to save design" });
  }
};


// Get price for current design (without saving)
export const getDesignPrice = async (req, res) => {
  try {
    const { designLayers = [], textLayers = [], zones = [], productId, selectedSize } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const basePriceBySize = getSizeBasePrice(product, selectedSize);

    const { totalPrice, breakdown } = calculateDesignPrice(
      designLayers,
      textLayers,
      zones,
      product,
      basePriceBySize // ✅ override base price by size
    );

    return res.json({
      price: totalPrice,
      breakdown,
      currency: "INR",
      basePrice: basePriceBySize, // ✅ now valid
      selectedSize: selectedSize || null,
      pricingMode: product.pricingMode || "normal",
      productName: product.name,
    });
  } catch (err) {
    console.error("Get design price error:", err);
    return res.status(500).json({ error: "Failed to calculate price" });
  }
};


// Update design with price calculation
export const updateDesign = async (req, res) => {
  try {
    

    const { id } = req.params;

    const {
      productId,
      productSlug,
      productColor,
      productColorName,
      views = [],
      previewImage,
      selectedSize,
    } = req.body;

    if (!productId || !productSlug) {
      return res.status(400).json({ error: "productId and productSlug are required" });
    }

    const design = await Design.findById(id);
    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // ✅ Always decide final size (if UI didn't send it, keep the old one)
    const finalSelectedSize = selectedSize || design.selectedSize || null;

    // ✅ helper: base price from sizePricing
    const getSizeBasePrice = (prod, size) => {
      const list = prod?.sizePricing || [];
      if (!size) return prod?.basePrice || 600;

      const found = list.find(
        (x) => String(x.size).toUpperCase() === String(size).toUpperCase()
      );

      return found?.price ?? prod?.basePrice ?? 600;
    };

    const basePriceBySize = getSizeBasePrice(product, finalSelectedSize);

    let totalDesignLayers = [];
    let totalTextLayers = [];
    let totalZones = [];

    // ✅ Normalize views exactly like saveDesign (includes inches + safe defaults)
    const updatedViews = (views || []).map((view) => {
      const viewCode = view.code || "front";
      const defaultZone = PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

      const updatedDesignLayers = (view.designLayers || []).map((layer) => {
        let imageUrl = layer.imageUrl;
        const apiUrl = process.env.API_URL || "https://maitrova.in/backend";
        if (imageUrl && imageUrl.includes(apiUrl)) {
          imageUrl = imageUrl.replace(apiUrl, "");
        }

        const {
          widthInches,
          heightInches,
          areaInches,
          rawPrintWidthInches,
          rawPrintHeightInches,
          rawPrintAreaInches,
        } = getLayerMeasurements(layer);

        const processedLayer = {
          ...layer,
          imageUrl,
          zone: normalizeZone(layer.zone, defaultZone),

          insideSafeArea:
            typeof layer.insideSafeArea === "boolean" ? layer.insideSafeArea : true,
          widthInches,
          heightInches,
          areaInches,
          rawPrintWidthInches,
          rawPrintHeightInches,
          rawPrintAreaInches,
        };

        totalDesignLayers.push(processedLayer);
        totalZones.push(processedLayer.zone);

        return processedLayer;
      });

      const updatedTextLayers = (view.textLayers || []).map((textLayer) => {
        const { widthInches, heightInches, areaInches } = getTextLayerMeasurements(textLayer);

        const processedTextLayer = {
          ...textLayer,
          zone: normalizeZone(textLayer.zone, defaultZone),
          widthInches,
          heightInches,
          areaInches,
        };

        totalTextLayers.push(processedTextLayer);
        return processedTextLayer;
      });

      return {
        ...view,
        designLayers: updatedDesignLayers,
        textLayers: updatedTextLayers,
        previewImage: view.previewImage || null,
      };
    });

    // ✅ IMPORTANT: calculate using size base price override
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones,
      product,
      basePriceBySize
    );

    // ✅ preview fallback
    let mainPreview = previewImage || design.previewImage || null;
    if (!mainPreview && updatedViews.length > 0) {
      const frontView = updatedViews.find((v) => v.code === "front");
      mainPreview = frontView?.previewImage || updatedViews[0]?.previewImage || null;
    }

    // ✅ update design doc
    design.user = design.user || req.user._id;
    design.product = product._id;
    design.productSlug = productSlug;
    design.productName = product.name;
    design.productColor = productColor || "#FFFFFF";
    design.productColorName = productColorName || productColor || "White";
    design.previewImage = mainPreview;
    design.views = updatedViews;

    design.selectedSize = finalSelectedSize;
    design.basePrice = basePriceBySize;

    design.pricingMode = product.pricingMode || "normal";
    design.calculatedPrice = totalPrice;
    design.priceBreakdown = breakdown;
    design.salePrice = totalPrice;

    const updatedDesign = await design.save();
    return res.status(200).json(updatedDesign);
  } catch (err) {
    console.error("Update design error:", err);
    return res.status(500).json({ error: "Failed to update design" });
  }
};




export const publishDesign = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;

    const {
      productName,
      description,
      category,
      subCategory,
      brand,
      stock,
      priceBreakdown,
      calculatedPrice
    } = req.body;

    const design = await Design.findById(id);

    if (!design)
      return res.status(404).json({ error: "Design not found" });

    // required fields validation
    if (!productName || !description || !category || !brand) {
      return res.status(400).json({
        error: "productName, description, category and brand required"
      });
    }

    // UPDATE BASIC INFO
    design.productName = productName;
    design.description = description;
    design.category = category;
    design.subCategory = subCategory || null;
    design.brand = brand;
    design.stock = stock || 0;

    // SAVE PRICE BREAKDOWN AS IS (NO CALCULATION)
    if (priceBreakdown) {
      design.priceBreakdown = priceBreakdown;
    }

    // SAVE CALCULATED PRICE DIRECTLY
    if (calculatedPrice !== undefined) {
      design.calculatedPrice = calculatedPrice;
    }

    // PUBLISH
    design.isPublished = true;
    design.publishedAt = new Date();

    const updated = await design.save();

    return res.json({
      success: true,
      data: updated
    });

  } catch (err) {
    console.error("Publish design error:", err);
    return res.status(500).json({
      error: "Failed to publish design"
    });
  }
};



export const listCatalogueDesigns = async (req, res) => {
  try {
    const apiUrl = process.env.API_URL || "https://maitrova.in/backend";

    const { page = 1, limit = 10 } = req.query;

    // Fetch designs with pagination
    const designs = await Design.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    console.log("Fetched designs from DB:", designs);
    // Check if designs is an array
    if (!Array.isArray(designs)) {
      return res.status(400).json({ success: false, message: "Invalid data structure for designs" });
    }

    // Process designs
    const processedDesigns = designs.map((design) => {
      // Ensure category field is part of the design object
      const category = design.category || "Uncategorized"; // Default to 'Uncategorized' if no category

      if (design.views && Array.isArray(design.views)) {
        design.views = design.views.map((view) => ({
          ...view,
          designLayers:
            view.designLayers?.map((layer) => ({
              ...layer,
              imageUrl: layer.imageUrl?.startsWith("/")
                ? `${apiUrl}${layer.imageUrl}`
                : layer.imageUrl,
            })) || [],
        }));
      }

      // Add category to the design object
      return { ...design, category };
    });

    // Count the total number of designs
    const total = await Design.countDocuments({ isPublished: true });

    return res.json({
      success: true,
      data: processedDesigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("List catalogue designs error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list catalogue designs",
    });
  }
};



export const updatedesigndetails = async (req, res) => {
  const designId = req.params.id;

  // Validate input data
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({ errors: errors.array() });
  // }

  try {
    const { category, subCategory, calculatedPrice, stock, description, newArrivals, bestSellers, isActive } = req.body;

    

    // Find the design by ID and update it
    const design = await Design.findById(designId);
    if (isActive !== undefined) design.isActive = isActive;
    if (!design) {
      return res.status(404).json({ message: "Design not found" });
    }

    // Update fields if provided
    if (category !== undefined) design.category = (category || "").trim();
    if (subCategory !== undefined) design.subCategory = (subCategory || "").trim();
    if (calculatedPrice !== undefined) design.calculatedPrice = calculatedPrice;
    if (stock !== undefined) design.stock = stock; // undefined check to allow stock=0
    if (description) design.description = description;
    if (newArrivals !== undefined) design.newArrivals = newArrivals; // handle new arrivals
    if (bestSellers !== undefined) design.bestSellers = bestSellers; // handle best sellers

    // Save the updated design
    await design.save();

    // Respond with the updated design
    res.json(design);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getDesignMeta = async (req, res) => {
  try {
    const designs = await Design.find({}, { category: 1, subCategory: 1 });

    const categoriesSet = new Set();
    const subMap = {}; // category -> Set(subCats)

    for (const d of designs) {
      const c = (d.category || "").trim();
      const s = (d.subCategory || "").trim();

      if (!c) continue;

      categoriesSet.add(c);

      if (!subMap[c]) subMap[c] = new Set();
      if (s) subMap[c].add(s);
    }

    const categories = Array.from(categoriesSet).sort();
    const subCategoriesByCategory = {};

    for (const c of categories) {
      subCategoriesByCategory[c] = Array.from(subMap[c] || []).sort();
    }

    return res.json({ categories, subCategoriesByCategory });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};



export const getDesign = async (req, res) => {
  try {
    const design = await Design.findById(req.params.id).lean();
    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }
    
    const apiUrl = process.env.API_URL || 'https://maitrova.in/backend';
    
    if (design.views) {
      design.views = design.views.map(view => ({
        ...view,
        designLayers: view.designLayers?.map(layer => ({
          ...layer,
          imageUrl: layer.imageUrl?.startsWith('/') 
            ? `${apiUrl}${layer.imageUrl}`
            : layer.imageUrl
        })) || []
      }));
    }
    
    return res.json(design);
  } catch (err) {
    console.error("Fetch design error:", err);
    return res.status(500).json({ error: "Failed to fetch design" });
  }
};

// For admin listing all designs
export const listDesigns = async (req, res) => {
  try {
    const apiUrl = process.env.API_URL || "https://maitrova.in/backend";

    // const filter = req.user?.role === "admin"
    //   ? {}
    //   : { user: req.user._id };

    const designs = await Design.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    designs.forEach((design) => {
      if (design.views) {
        design.views = design.views.map((view) => ({
          ...view,
          designLayers: view.designLayers?.map((layer) => ({
            ...layer,
            imageUrl: layer.imageUrl?.startsWith("/")
              ? `${apiUrl}${layer.imageUrl}`
              : layer.imageUrl,
          })) || [],
        }));
      }
    });

    return res.json(designs);
  } catch (err) {
    console.error("List designs error:", err);
    return res.status(500).json({ error: "Failed to list designs" });
  }
};

export const deleteDesign = async (req, res) => {
  try {
    const { id } = req.params;
    
    const design = await Design.findByIdAndDelete(id);
    
    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }
    
    return res.status(200).json({ 
      message: "Design deleted successfully",
      deletedId: id 
    });
  } catch (err) {
    console.error("Delete design error:", err);
    return res.status(500).json({ error: "Failed to delete design" });
  }
};

