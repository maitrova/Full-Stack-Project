const CustomerReviews = () => {
  const reviews = [
    {
      id: 1,
      text: "We absolutely love the choice of products and designs. Always a winner for gifts for our grandchildren. The quality is exceptional and the printing is very durable.",
      author: "Suzanne B.",
      location: "Naples, FL",
      time: "2 hours ago",
      rating: 5,
      verified: true,
      helpful: 12,
      product: "Custom T-Shirts Bundle",
      size: "Medium",
      color: "Navy Blue"
    },
    {
      id: 2,
      text: "Great service that made sure my design would be perfect and helped me edit it to avoid any distortion. The customer support team was very patient and professional.",
      author: "Kerstey D.",
      location: "Covington, LA",
      time: "3 hours ago",
      rating: 4,
      verified: true,
      helpful: 8,
      product: "Premium Hoodies",
      size: "Large",
      color: "Black"
    },
    {
      id: 3,
      text: "Still working on the order: Spoke to Emily yesterday; she was very helpful and I feel confident she will get it done for me. Thanks for the excellent customer service!",
      author: "Terry C.",
      location: "Tirley Park, IL",
      time: "5 hours ago",
      rating: 5,
      verified: false,
      helpful: 3,
      product: "Corporate Polo Shirts",
      size: "XL",
      color: "White"
    }
  ];

  const overallStats = {
    averageRating: 4.8,
    totalReviews: 12473,
    ratingBreakdown: [
      { stars: 5, percentage: 84, count: 10477 },
      { stars: 4, percentage: 12, count: 1497 },
      { stars: 3, percentage: 3, count: 374 },
      { stars: 2, percentage: 1, count: 125 },
      { stars: 1, percentage: 0, count: 0 }
    ]
  };

  const StarRating = ({ rating, size = "small" }) => {
    const starSize = size === "large" ? "w-5 h-5" : "w-4 h-4";
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${starSize} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <section className="py-12 bg-white border-t border-gray-200">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Rating Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              {/* Overall Rating */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <StarRating rating={5} size="large" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{overallStats.averageRating} out of 5</div>
                <div className="text-gray-600 text-sm">Based on {overallStats.totalReviews.toLocaleString()} reviews</div>
              </div>

              {/* Rating Breakdown */}
              <div className="space-y-2">
                {overallStats.ratingBreakdown.map((item) => (
                  <div key={item.stars} className="flex items-center text-sm">
                    <span className="w-12 text-gray-600">{item.stars} star</span>
                    <div className="flex-1 mx-2">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-400 h-2 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="w-12 text-gray-500 text-right">{item.percentage}%</span>
                  </div>
                ))}
              </div>

              {/* Filter Buttons */}
              <div className="mt-6 space-y-2">
                <button className="w-full text-left text-blue-600 hover:text-blue-800 text-sm py-1">
                  ⭐ 5 Star (10,477)
                </button>
                <button className="w-full text-left text-blue-600 hover:text-blue-800 text-sm py-1">
                  ⭐ 4 Star (1,497)
                </button>
                <button className="w-full text-left text-blue-600 hover:text-blue-800 text-sm py-1">
                  ⭐ 3 Star (374)
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Reviews */}
          <div className="lg:col-span-3">
            {/* Review Sort/Filter Bar */}
            <div className="flex flex-wrap items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <select className="text-sm border border-gray-300 rounded px-3 py-1 bg-white">
                  <option>Top reviews</option>
                  <option>Most recent</option>
                  <option>Most helpful</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                Showing 3 of {overallStats.totalReviews.toLocaleString()} reviews
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6">
                  {/* Review Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <StarRating rating={review.rating} />
                      <h3 className="font-bold text-gray-900 mt-1">{review.product}</h3>
                    </div>
                    <span className="text-gray-500 text-sm">{review.time}</span>
                  </div>

                  {/* Review Meta */}
                  <div className="flex items-center space-x-4 mb-3">
                    <span className="text-sm font-medium text-gray-900">{review.author}</span>
                    {review.verified && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ✅ Verified Purchase
                      </span>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="text-sm text-gray-600 mb-3">
                    <span>Size: {review.size} | Color: {review.color}</span>
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-800 mb-4 leading-relaxed">{review.text}</p>

                  {/* Helpful Section */}
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">Helpful?</span>
                    <button className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 hover:bg-gray-50">
                      Yes ({review.helpful})
                    </button>
                    <button className="text-sm text-gray-600 hover:text-gray-800">
                      Report
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            <div className="text-center mt-8">
              <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors duration-200 font-medium">
                Load more reviews
              </button>
            </div>

            {/* Write Review CTA */}
            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2">Share your experience</h3>
              <p className="text-gray-600 text-sm mb-4">Help other customers make informed decisions</p>
              <button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-6 py-2 rounded-full font-medium text-sm transition-colors duration-200">
                Write a customer review
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomerReviews;