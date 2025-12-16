// server/controllers/designController.js
import { Design } from "../models/Design.js";
import { Product } from "../models/Product.js";

const PRINT_ZONE_DEFAULTS = {
  front: "front-full",
  back: "back-full",
  right: "sleeve-right",
  left: "sleeve-left",
};


// export const saveDesign = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({ error: "Not authorized" });
//     }

//     const { productId, productSlug, productColor, views = [], previewImage } =
//       req.body;

//     if (!productId || !productSlug) {
//       return res
//         .status(400)
//         .json({ error: "productId and productSlug are required" });
//     }

//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     const normalizedViews = views.map((view) => {
//       const viewCode = view.code || "front";
//       const defaultZone =
//         PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

//       const designLayers = (view.designLayers || []).map((layer) => {
//         let imageUrl = layer.imageUrl;
//         if (imageUrl && imageUrl.includes("http://localhost:5000")) {
//           imageUrl = imageUrl.replace("http://localhost:5000", "");
//         }

//         return {
//           ...layer,
//           imageUrl,
//           zone: layer.zone || defaultZone,
//           insideSafeArea:
//             typeof layer.insideSafeArea === "boolean"
//               ? layer.insideSafeArea
//               : true,
//         };
//       });

//       return {
//         ...view,
//         designLayers,
//         previewImage: view.previewImage || null,
//       };
//     });

//     let mainPreview = previewImage || null;
//     if (!mainPreview && normalizedViews.length > 0) {
//       const frontView = normalizedViews.find((v) => v.code === "front");
//       mainPreview =
//         frontView?.previewImage || normalizedViews[0]?.previewImage || null;
//     }

//     const design = await Design.create({
//       user: req.user._id,          // ✅ attach owner
//       product: product._id,
//       productSlug,
//       productName: product.name,
//       productColor: productColor || "#FFFFFF",
//       previewImage: mainPreview,
//       views: normalizedViews,
//     });

//     return res.status(201).json(design);
//   } catch (err) {
//     console.error("Save design error:", err);
//     return res.status(500).json({ error: "Failed to save design" });
//   }
// };

// admin pushed designs


export const publishDesign = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const { id } = req.params;
    const { title = "", description = "", salePrice = 0 } = req.body;

    const design = await Design.findById(id);
    if (!design) return res.status(404).json({ error: "Design not found" });

    // (optional) only allow admin to publish his own designs
    // if (design.user.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({ error: "Not your design" });
    // }

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
    const apiUrl = process.env.API_URL || "http://localhost:5000";

    // ✅ ONLY filter by published
    const designs = await Design.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .lean();

    // normalize image URLs
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
    
    // Convert relative paths to full URLs
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    
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

// for a admin listing all designs
export const listDesigns = async (req, res) => {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:5000";

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

// export const updateDesign = async (req, res) => {
//   try {
//     const { id } = req.params; // design ID from URL
//     const { productId, productSlug, productColor, views, previewImage } = req.body;

//     if (!productId || !productSlug) {
//       return res.status(400).json({ error: "productId and productSlug are required" });
//     }

//     // Find the existing design by ID
//     const design = await Design.findById(id);
//     if (!design) {
//       return res.status(404).json({ error: "Design not found" });
//     }

//     // Update product details
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     const updatedViews = views.map((view) => {
//       const viewCode = view.code || "front";
//       const defaultZone = PRINT_ZONE_DEFAULTS[viewCode] || PRINT_ZONE_DEFAULTS.front;

//       const updatedDesignLayers = (view.designLayers || []).map((layer) => {
//         // Extract just the path if it's a full URL
//         let imageUrl = layer.imageUrl;
//         if (imageUrl && imageUrl.includes('http://localhost:5000')) {
//           // Extract just the path part
//           imageUrl = imageUrl.replace('http://localhost:5000', '');
//         }
        
//         return {
//           ...layer,
//           imageUrl,
//           zone: layer.zone || defaultZone,
//           insideSafeArea: typeof layer.insideSafeArea === "boolean" ? layer.insideSafeArea : true,
//         };
//       });

//       return {
//         ...view,
//         designLayers: updatedDesignLayers,
//         previewImage: view.previewImage || null, // keep previewImage for the view
//       };
//     });

//     // pick main preview: explicit one or from front / first view
//     let mainPreview = previewImage || design.previewImage;
//     if (!mainPreview && updatedViews.length > 0) {
//       const frontView = updatedViews.find((v) => v.code === "front");
//       mainPreview = frontView?.previewImage || updatedViews[0]?.previewImage || null;
//     }

//     // Update the design
//     design.product = product._id;
//     design.productSlug = productSlug;
//     design.productName = product.name;
//     design.productColor = productColor || "#FFFFFF";
//     design.previewImage = mainPreview;
//     design.views = updatedViews;

//     // Save updated design to the database
//     const updatedDesign = await design.save();

//     return res.status(200).json(updatedDesign);
//   } catch (err) {
//     console.error("Update design error:", err);
//     return res.status(500).json({ error: "Failed to update design" });
//   }
// };

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








// Constants for pricing
const BASE_PRICE = 600;
const FIXED_SIZE_INCHES = 4; // 4x4 inches
const PRICE_PER_SQ_INCH = 6;
const SLEEVE_PRICE = 30;
const PRINT_DPI = 300; // 300 DPI for print quality

// Helper function to calculate inches from pixels
const pixelsToInches = (pixels) => pixels / PRINT_DPI;

// Helper function to calculate text area (approximation)
const calculateTextAreaInches = (fontSize) => {
  // Approximate text area based on font size
  // Assuming average character width = fontSize * 0.6
  // and average character height = fontSize * 0.8
  // This is an approximation - adjust as needed
  const widthPerChar = fontSize * 0.6 / PRINT_DPI;
  const heightPerChar = fontSize * 0.8 / PRINT_DPI;
  const avgCharsPerLine = 5; // Average text length
  return widthPerChar * avgCharsPerLine * heightPerChar;
};

// Calculate price for a single layer
const calculateLayerPrice = (layer, zone) => {
  if (zone === "sleeve-left" || zone === "sleeve-right") {
    return SLEEVE_PRICE;
  }
  
  // Calculate area in square inches
  let areaInches;
  if (layer.areaInches) {
    // If area is already calculated (for text)
    areaInches = layer.areaInches;
  } else if (layer.widthInches && layer.heightInches) {
    // If width/height are provided
    areaInches = layer.widthInches * layer.heightInches;
  } else if (layer.renderedWidthPx && layer.renderedHeightPx) {
    // Calculate from pixels
    const widthInches = pixelsToInches(layer.renderedWidthPx);
    const heightInches = pixelsToInches(layer.renderedHeightPx);
    areaInches = widthInches * heightInches;
  } else {
    // Default to fixed size if no dimensions
    areaInches = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
  }
  
  // Calculate additional area beyond fixed size
  const additionalArea = Math.max(0, areaInches - (FIXED_SIZE_INCHES * FIXED_SIZE_INCHES));
  return additionalArea * PRICE_PER_SQ_INCH;
};

// Calculate total price for a design
// Simplified and consistent price calculation
const calculateDesignPrice = (designLayers, textLayers, zones) => {
  let totalPrice = BASE_PRICE;
  const breakdown = {
    basePrice: BASE_PRICE,
    designLayers: [],
    textLayers: [],
    sleeves: { count: 0, total: 0 },
    additionalArea: 0,
    totalPrice: BASE_PRICE
  };

  // Calculate price for design layers (images)
  designLayers.forEach((layer) => {
    const zone = layer.zone || 'front-full';
    
    if (zone === "sleeve-left" || zone === "sleeve-right") {
      breakdown.sleeves.count += 1;
      breakdown.sleeves.total += SLEEVE_PRICE;
      totalPrice += SLEEVE_PRICE;
      
      breakdown.designLayers.push({
        id: layer.id,
        type: 'sleeve',
        zone,
        price: SLEEVE_PRICE,
      });
    } else {
      // Use provided area or calculate from dimensions
      let areaInches = layer.areaInches;
      
      if (!areaInches && layer.widthInches && layer.heightInches) {
        areaInches = layer.widthInches * layer.heightInches;
      } else if (!areaInches && layer.renderedWidthPx && layer.renderedHeightPx) {
        // Calculate from pixels
        const widthInches = pixelsToInches(layer.renderedWidthPx);
        const heightInches = pixelsToInches(layer.renderedHeightPx);
        areaInches = widthInches * heightInches;
      } else if (!areaInches) {
        // Default area if no dimensions
        areaInches = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
      }
      
      // Calculate additional area beyond fixed size
      const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
      const additionalArea = Math.max(0, areaInches - fixedArea);
      const layerPrice = additionalArea * PRICE_PER_SQ_INCH;
      
      breakdown.additionalArea += additionalArea;
      totalPrice += layerPrice;
      
      breakdown.designLayers.push({
        id: layer.id,
        type: 'image',
        zone,
        areaInches: areaInches.toFixed(2),
        additionalArea: additionalArea.toFixed(2),
        price: layerPrice,
        widthInches: layer.widthInches,
        heightInches: layer.heightInches
      });
    }
  });

  // Calculate price for text layers
  textLayers.forEach((textLayer) => {
    // Use provided area or calculate
    let areaInches = textLayer.areaInches;
    
    if (!areaInches) {
      // Calculate from font size (approximation)
      const fontSizeInches = textLayer.fontSize / PRINT_DPI;
      const avgChars = textLayer.text?.length || 5;
      const charWidthInches = fontSizeInches * 0.6;
      const charHeightInches = fontSizeInches * 1.2;
      areaInches = (charWidthInches * avgChars) * charHeightInches;
    }
    
    const fixedArea = FIXED_SIZE_INCHES * FIXED_SIZE_INCHES;
    const additionalArea = Math.max(0, areaInches - fixedArea);
    const textPrice = additionalArea * PRICE_PER_SQ_INCH;
    
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
        if (imageUrl && imageUrl.includes("http://localhost:5000")) {
          imageUrl = imageUrl.replace("http://localhost:5000", "");
        }

        // Calculate dimensions in inches
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

        // Collect for price calculation
        totalDesignLayers.push(processedLayer);
        totalZones.push(processedLayer.zone);

        return processedLayer;
      });

      const textLayers = (view.textLayers || []).map((textLayer) => {
        // Calculate text area
        const areaInches = calculateTextAreaInches(textLayer.fontSize);
        
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

    // Calculate price
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones
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
      basePrice: BASE_PRICE,
      calculatedPrice: totalPrice,
      priceBreakdown: breakdown,
      salePrice: totalPrice, // Set sale price to calculated price
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
    const { designLayers = [], textLayers = [], zones = [] } = req.body;

    const { totalPrice, breakdown } = calculateDesignPrice(designLayers, textLayers, zones);

    return res.json({
      price: totalPrice,
      breakdown,
      currency: "INR",
      basePrice: BASE_PRICE,
      fixedSizeInches: FIXED_SIZE_INCHES,
      pricePerSqInch: PRICE_PER_SQ_INCH,
      sleevePrice: SLEEVE_PRICE,
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
        if (imageUrl && imageUrl.includes('http://localhost:5000')) {
          imageUrl = imageUrl.replace('http://localhost:5000', '');
        }

        // Calculate dimensions in inches
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
        // Calculate text area
        const areaInches = calculateTextAreaInches(textLayer.fontSize);
        
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

    // Calculate price
    const { totalPrice, breakdown } = calculateDesignPrice(
      totalDesignLayers,
      totalTextLayers,
      totalZones
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

// Add this to your existing exports



