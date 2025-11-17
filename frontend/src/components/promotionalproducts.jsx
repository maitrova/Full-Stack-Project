import React from "react";

// PromotionalProductsComponent.jsx
// Single-file React component styled with Tailwind CSS
// Matches the layout and look of the provided image: 2-row, 4-column product grid

const productCategories = [
    {
      name: "T-shirts",
      description: "Custom printed t-shirts for your group or event",
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop&auto=format",
      Alt: "Custom printed t-shirts"
    },
    {
      name: "Sweatshirts",
      description: "Comfortable and warm custom sweatshirts",
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=300&fit=crop&auto=format",
      Alt: "Custom sweatshirts"
    },
    {
      name: "Hoodies",
      description: "Branded Hoodies team",
      image: "https://media.istockphoto.com/id/169726534/photo/man-threatening-with-pocket-knife.jpg?s=612x612&w=0&k=20&c=beLqLztDCkp4O4624xGSbMORNaIv7EzLdS65kxMVgjM=",
      Alt: "Custom hats and caps"
    },
    {
      name: "shirts",
      description: "Professional outerwear with your logo",
      image: "https://frenchcrown.in/cdn/shop/articles/summer_shirts_ideas_2268dcbd-f300-4589-ad8d-83f942edaed8.png?v=1728457385&width=2000",
      Alt: "Custom jackets and vests"
    },
    {
      name: "Bags",
      description: "Custom bags and totes for everyday use",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop&auto=format",
      Alt: "Custom bags and totes"
    },
    {
      name: "Drinkware",
      description: "Branded water bottles and mugs",
      image: "https://images.unsplash.com/photo-1544003484-3cd181d17917?w=400&h=300&fit=crop&auto=format",
      Alt: "Custom drinkware"
    },
    {
      name: "Polos & Business Wear",
      description: "Professional attire for your business",
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=300&fit=crop&auto=format",
      Alt: "Custom polos and business wear"
    },
    {
      name: "Women's Workwear & Uniforms",
      description: "Custom uniforms for your workforce",
      image: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRDgaU_HkjZIW-jIb_nJkNjvjCHEQzhk9dpPASUXKMmnEZBI3Kf1Z89FbiZr9hfMjAZPaPjjNSQ3dbbmWS8XFuKEZm1DF1TT0YffI7bF0lbM3cb5atTyoMdlg",
      Alt: "Custom workwear and uniforms"
    }
  ];

export default function PromotionalProductsComponent() {
return (
    <div className="min-h-screen bg-white py-12 px-6 lg:px-16">
      <div className="max-w-7xl mx-auto">
        
        {/* Grid cards (4 columns on lg, 2 on md, 1 on sm) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {productCategories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-start">
              {/* Image container with fixed aspect ratio */}
              <div className="w-full p-6 flex items-center justify-center">
                <div className="w-full h-64 overflow-hidden flex items-center justify-center bg-gray-50 rounded-lg">
                  {/* Image with fixed container and proper object-fit */}
                  <img
                    src={cat.image}
                    alt={cat.Alt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial, Helvetica, sans-serif' font-size='20'%3EImage not found%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </div>

              {/* Caption */}
              <div className="mt-3 w-full text-center">
                <p className="text-sm text-gray-700 font-medium">{cat.name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Optional bottom spacing */}
        <div className="h-12" />
      </div>
    </div>
  );
}