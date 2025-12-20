import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";

const PRINT_ZONE_DEFAULTS = {
  front: "front-full",
  back: "back-full",
  right: "sleeve-right",
  left: "sleeve-left",
};

const PRINT_DPI = 300; // 300 DPI for print quality
const MINIMUM_DESIGN_CHARGE = 30; // Minimum ₹30 for any design up to 4x4 inches

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

// Calculate price based on product's pricing mode
const calculateDesignPrice = (designLayers, textLayers, zones, product) => {
  const basePrice = product.basePrice || 600;
  let totalPrice = basePrice;
  
  const breakdown = {
    basePrice: basePrice,
    pricingMode: product.pricingMode || 'normal',
    designLayers: [],
    textLayers: [],
    sleeves: { count: 0, total: 0 },
    additionalArea: 0,
    minimumDesignCharges: 0,
    unlimitedPricing: null,
    normalPricing: null,
    totalPrice: basePrice
  };

  // UNLIMITED PRICING MODE (Flat rate)
  if (product.pricingMode === 'unlimited' && product.unlimitedPricing?.enabled) {
    const flatCharge = product.unlimitedPricing.flatCharge || 200;
    totalPrice += flatCharge;
    
    breakdown.unlimitedPricing = {
      enabled: true,
      flatCharge: flatCharge,
      label: product.unlimitedPricing.label || "Unlimited Design",
      description: product.unlimitedPricing.description,
      chargeApplied: flatCharge
    };
    
    // Track design layers (for display only, not for charging)
    designLayers.forEach((layer) => {
      const zone = layer.zone || 'front-full';
      let areaInches = layer.areaInches;
      
      if (!areaInches && layer.widthInches && layer.heightInches) {
        areaInches = layer.widthInches * layer.heightInches;
      } else if (!areaInches && layer.renderedWidthPx && layer.renderedHeightPx) {
        const widthInches = pixelsToInches(layer.renderedWidthPx);
        const heightInches = pixelsToInches(layer.renderedHeightPx);
        areaInches = widthInches * heightInches;
      }
      
      breakdown.designLayers.push({
        id: layer.id,
        type: zone.includes('sleeve') ? 'sleeve' : 'image',
        zone,
        areaInches: (areaInches || 0).toFixed(2),
        price: 0, // No charge in unlimited mode
        unlimited: true
      });
    });
    
    // Track text layers (for display only)
    textLayers.forEach((textLayer) => {
      let areaInches = textLayer.areaInches;
      
      if (!areaInches) {
        areaInches = calculateTextAreaInches(textLayer.fontSize, textLayer.text);
      }
      
      breakdown.textLayers.push({
        id: textLayer.id,
        text: textLayer.text,
        fontSize: textLayer.fontSize,
        areaInches: areaInches.toFixed(3),
        price: 0, // No charge in unlimited mode
        unlimited: true
      });
    });

  } 
  // NORMAL PRICING MODE (Size-based pricing with minimum charge)
  else {
    const fixedSizeInches = product.normalPricing?.fixedSizeInches || 4;
    const pricePerSqInch = product.normalPricing?.pricePerSqInch || 6;
    const sleevePrice = product.normalPricing?.sleevePrice || 30;
    
    breakdown.normalPricing = {
      fixedSizeInches: fixedSizeInches,
      pricePerSqInch: pricePerSqInch,
      sleevePrice: sleevePrice,
      minimumDesignCharge: MINIMUM_DESIGN_CHARGE
    };

    // Calculate price for design layers (images)
    designLayers.forEach((layer) => {
      const zone = layer.zone || 'front-full';
      
      if (zone === "sleeve-left" || zone === "sleeve-right") {
        // Fixed price for sleeves
        breakdown.sleeves.count += 1;
        breakdown.sleeves.total += sleevePrice;
        totalPrice += sleevePrice;
        
        breakdown.designLayers.push({
          id: layer.id,
          type: 'sleeve',
          zone,
          price: sleevePrice,
        });
      } else {
        // Calculate area for normal pricing
        let areaInches = layer.areaInches;
        
        if (!areaInches && layer.widthInches && layer.heightInches) {
          areaInches = layer.widthInches * layer.heightInches;
        } else if (!areaInches && layer.renderedWidthPx && layer.renderedHeightPx) {
          const widthInches = pixelsToInches(layer.renderedWidthPx);
          const heightInches = pixelsToInches(layer.renderedHeightPx);
          areaInches = widthInches * heightInches;
        } else if (!areaInches) {
          areaInches = fixedSizeInches * fixedSizeInches;
        }
        
        // Calculate additional area beyond fixed size
        const fixedArea = fixedSizeInches * fixedSizeInches;
        const additionalArea = Math.max(0, areaInches - fixedArea);
        
        // Calculate price with minimum charge
        let layerPrice = 0;
        
        if (areaInches <= fixedArea) {
          // For designs up to fixed size, charge minimum amount
          layerPrice = MINIMUM_DESIGN_CHARGE;
          breakdown.minimumDesignCharges = (breakdown.minimumDesignCharges || 0) + MINIMUM_DESIGN_CHARGE;
        } else {
          // For larger designs
          layerPrice = additionalArea * pricePerSqInch;
          if (layerPrice < MINIMUM_DESIGN_CHARGE) {
            // Ensure minimum charge
            layerPrice = MINIMUM_DESIGN_CHARGE;
            breakdown.minimumDesignCharges = (breakdown.minimumDesignCharges || 0) + MINIMUM_DESIGN_CHARGE;
          }
        }
        
        if (additionalArea > 0) {
          breakdown.additionalArea += additionalArea;
        }
        
        totalPrice += layerPrice;
        
        breakdown.designLayers.push({
          id: layer.id,
          type: 'image',
          zone,
          areaInches: areaInches.toFixed(2),
          additionalArea: additionalArea.toFixed(2),
          price: layerPrice,
          widthInches: layer.widthInches,
          heightInches: layer.heightInches,
          minimumChargeApplied: areaInches <= fixedArea
        });
      }
    });

    // Calculate price for text layers with minimum charge
    textLayers.forEach((textLayer) => {
      let areaInches = textLayer.areaInches;
      
      if (!areaInches) {
        areaInches = calculateTextAreaInches(textLayer.fontSize, textLayer.text);
      }
      
      const fixedArea = fixedSizeInches * fixedSizeInches;
      const additionalArea = Math.max(0, areaInches - fixedArea);
      let textPrice = additionalArea * pricePerSqInch;
      
      // Apply minimum charge for text
      if (areaInches > 0 && textPrice < MINIMUM_DESIGN_CHARGE && areaInches <= fixedArea) {
        textPrice = MINIMUM_DESIGN_CHARGE;
        breakdown.minimumDesignCharges = (breakdown.minimumDesignCharges || 0) + MINIMUM_DESIGN_CHARGE;
      }
      
      if (additionalArea > 0) {
        breakdown.additionalArea += additionalArea;
      }
      
      if (textPrice > 0) {
        totalPrice += textPrice;
        breakdown.textLayers.push({
          id: textLayer.id,
          text: textLayer.text,
          fontSize: textLayer.fontSize,
          areaInches: areaInches.toFixed(3),
          additionalArea: additionalArea.toFixed(3),
          price: textPrice,
        });
      }
    });
  }

  breakdown.totalPrice = totalPrice;
  return { totalPrice, breakdown };
};





// Save design with price calculation
export const saveDesign = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const { productId, productSlug, productColor, views = [], previewImage } = req.body;

    if (!productId || !productSlug) {
      return res.status(400).json({ error: "productId and productSlug are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let totalDesignLayers = [];
    let totalTextLayers = [];
    let totalZones = [];

    const normalizedViews = views.map((view) => {
      const viewCode = view.code || "front";
      const defaultZone = PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

      const designLayers = (view.designLayers || []).map((layer) => {
        let imageUrl = layer.imageUrl;
        const apiUrl = process.env.API_URL || "https://narifighter.online/backend";
        if (imageUrl && imageUrl.includes(apiUrl)) {
          imageUrl = imageUrl.replace(apiUrl, "");
        }

        let widthInches, heightInches, areaInches;
        if (layer.renderedWidthPx && layer.renderedHeightPx) {
          widthInches = pixelsToInches(layer.renderedWidthPx);
          heightInches = pixelsToInches(layer.renderedHeightPx);
          areaInches = widthInches * heightInches;
        }

        const processedLayer = {
          ...layer,
          imageUrl,
          zone: layer.zone || defaultZone,
          insideSafeArea: typeof layer.insideSafeArea === "boolean"
            ? layer.insideSafeArea
            : true,
          widthInches,
          heightInches,
          areaInches,
        };

        totalDesignLayers.push(processedLayer);
        totalZones.push(processedLayer.zone);

        return processedLayer;
      });

      const textLayers = (view.textLayers || []).map((textLayer) => {
        const areaInches = calculateTextAreaInches(textLayer.fontSize, textLayer.text);
        
        const processedTextLayer = {
          ...textLayer,
          widthInches: null,
          heightInches: null,
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

    // Calculate price based on product's pricing mode
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones,
      product
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
      previewImage: mainPreview,
      views: normalizedViews,
      basePrice: product.basePrice || 600,
      pricingMode: product.pricingMode || 'normal',
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
    const { designLayers = [], textLayers = [], zones = [], productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { totalPrice, breakdown } = calculateDesignPrice(
      designLayers, 
      textLayers, 
      zones, 
      product
    );

    return res.json({
      price: totalPrice,
      breakdown,
      currency: "INR",
      basePrice: product.basePrice || 600,
      pricingMode: product.pricingMode || 'normal',
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
    const { productId, productSlug, productColor, views, previewImage } = req.body;

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

    let totalDesignLayers = [];
    let totalTextLayers = [];
    let totalZones = [];

    const updatedViews = views.map((view) => {
      const viewCode = view.code || "front";
      const defaultZone = PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

      const updatedDesignLayers = (view.designLayers || []).map((layer) => {
        let imageUrl = layer.imageUrl;
        const apiUrl = process.env.API_URL || "https://narifighter.online/backend";
        if (imageUrl && imageUrl.includes(apiUrl)) {
          imageUrl = imageUrl.replace(apiUrl, "");
        }

        let widthInches, heightInches, areaInches;
        if (layer.renderedWidthPx && layer.renderedHeightPx) {
          widthInches = pixelsToInches(layer.renderedWidthPx);
          heightInches = pixelsToInches(layer.renderedHeightPx);
          areaInches = widthInches * heightInches;
        }

        const processedLayer = {
          ...layer,
          imageUrl,
          zone: layer.zone || defaultZone,
          insideSafeArea: typeof layer.insideSafeArea === "boolean" 
            ? layer.insideSafeArea 
            : true,
          widthInches,
          heightInches,
          areaInches,
        };

        totalDesignLayers.push(processedLayer);
        totalZones.push(processedLayer.zone);

        return processedLayer;
      });

      const textLayers = (view.textLayers || []).map((textLayer) => {
        const areaInches = calculateTextAreaInches(textLayer.fontSize, textLayer.text);
        
        const processedTextLayer = {
          ...textLayer,
          widthInches: null,
          heightInches: null,
          areaInches,
        };

        totalTextLayers.push(processedTextLayer);
        return processedTextLayer;
      });

      return {
        ...view,
        designLayers: updatedDesignLayers,
        textLayers,
        previewImage: view.previewImage || null,
      };
    });

    // Calculate price based on product's pricing mode
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones,
      product
    );

    let mainPreview = previewImage || design.previewImage;
    if (!mainPreview && updatedViews.length > 0) {
      const frontView = updatedViews.find((v) => v.code === "front");
      mainPreview = frontView?.previewImage || updatedViews[0]?.previewImage || null;
    }

    // Update the design
    design.product = product._id;
    design.productSlug = productSlug;
    design.productName = product.name;
    design.productColor = productColor || "#FFFFFF";
    design.previewImage = mainPreview;
    design.views = updatedViews;
    design.basePrice = product.basePrice || 600;
    design.pricingMode = product.pricingMode || 'normal';
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

// Admin push designs
export const publishDesign = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { title = "", description = "", salePrice = 0 } = req.body;

    const design = await Design.findById(id);
    if (!design) return res.status(404).json({ error: "Design not found" });

    design.isPublished = true;
    design.publishedAt = new Date();
    design.title = title;
    design.description = description;
    design.salePrice = salePrice || design.salePrice;

    const updated = await design.save();
    return res.json(updated);
  } catch (err) {
    console.error("Publish design error:", err);
    return res.status(500).json({ error: "Failed to publish design" });
  }
};

export const listCatalogueDesigns = async (req, res) => {
  try {
    const apiUrl = process.env.API_URL || "https://narifighter.online/backend";

    const designs = await Design.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .lean();

    designs.forEach((design) => {
      if (design.views) {
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
    });

    return res.json(designs);
  } catch (err) {
    console.error("List catalogue designs error:", err);
    return res.status(500).json({ error: "Failed to list catalogue designs" });
  }
};

export const getDesign = async (req, res) => {
  try {
    const design = await Design.findById(req.params.id).lean();
    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }
    
    const apiUrl = process.env.API_URL || 'https://narifighter.online/backend';
    
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
    const apiUrl = process.env.API_URL || "https://narifighter.online/backend";

    const filter = req.user?.role === "admin"
      ? {}
      : { user: req.user._id };

    const designs = await Design.find(filter)
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