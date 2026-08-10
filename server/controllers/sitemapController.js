import { Blog } from "../models/Blog.js";
import Dropproduct from "../models/dropproduct.model.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import { attachReadymadePricing } from "../utils/readymadePricing.js";

const DEFAULT_SITE_URL = "https://maitrova.in";
const DEFAULT_IMAGE_BASE_URL = "https://maitrova.in/backend";
const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i;
const SPECIAL_URL_RE = /^(?:data:|blob:)/i;
const OUTPUTS_SEGMENT_RE = /(?:^|\/)outputs\/.+$/i;

const getSiteUrl = () => {
  const configured =
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    DEFAULT_SITE_URL;

  return String(configured).trim().replace(/\/+$/, "") || DEFAULT_SITE_URL;
};

const getImageBaseUrl = () => {
  const configured =
    process.env.IMAGE_BASE_URL ||
    process.env.API_URL ||
    DEFAULT_IMAGE_BASE_URL;

  return String(configured).trim().replace(/\/+$/, "") || DEFAULT_IMAGE_BASE_URL;
};

const xmlEscape = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (value = "") =>
  String(value || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeRouteSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const slugifyDropProductName = (value = "") => normalizeRouteSegment(value);

const getRawImagePath = (image) => {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (typeof image === "object") {
    return image.url || image.path || image.src || "";
  }
  return "";
};

const buildImageUrl = (image) => {
  const rawPath = getRawImagePath(image);
  if (!rawPath) return "";
  if (ABSOLUTE_URL_RE.test(rawPath) || SPECIAL_URL_RE.test(rawPath)) {
    return rawPath;
  }

  const normalizedRawPath = String(rawPath).replace(/\\/g, "/");
  const outputsMatch = normalizedRawPath.match(OUTPUTS_SEGMENT_RE);
  const publicPath = outputsMatch ? outputsMatch[0].replace(/^\/+/, "") : normalizedRawPath;

  const imageBaseUrl = getImageBaseUrl();
  return `${imageBaseUrl}${publicPath.startsWith("/") ? "" : "/"}${publicPath}`;
};

const toIsoDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseInlineImageUrls = (content = "") => {
  const html = String(content || "");
  const urls = [];
  const imageTagRe = /<img\b[^>]*\b(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match = imageTagRe.exec(html);

  while (match) {
    urls.push(match[1]);
    match = imageTagRe.exec(html);
  }

  return urls;
};

const uniqueImageEntries = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const loc = String(item?.loc || "").trim();
    if (!loc || seen.has(loc)) return false;
    seen.add(loc);
    return true;
  });
};

const makeUrlEntry = (path, lastmod, priority, changefreq) => ({
  path,
  lastmod: toIsoDate(lastmod),
  priority,
  changefreq,
});

const buildSitemapXml = (entries = []) => {
  const siteUrl = getSiteUrl();
  const body = entries
    .map((entry) => {
      const tags = [
        `<loc>${xmlEscape(`${siteUrl}${entry.path === "/" ? "" : entry.path}`)}</loc>`,
      ];

      if (entry.lastmod) tags.push(`<lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
      if (entry.changefreq) tags.push(`<changefreq>${xmlEscape(entry.changefreq)}</changefreq>`);
      if (entry.priority !== undefined && entry.priority !== null) {
        tags.push(`<priority>${xmlEscape(String(entry.priority))}</priority>`);
      }

      return `  <url>\n${tags.map((tag) => `    ${tag}`).join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
};

const buildImageSitemapXml = (entries = []) => {
  const siteUrl = getSiteUrl();
  const body = entries
    .filter((entry) => Array.isArray(entry.images) && entry.images.length > 0)
    .map((entry) => {
      const imageTags = uniqueImageEntries(entry.images)
        .map((image) => {
          const tags = [`      <image:loc>${xmlEscape(image.loc)}</image:loc>`];
          if (image.title) {
            tags.push(`      <image:title>${xmlEscape(image.title)}</image:title>`);
          }
          return `    <image:image>\n${tags.join("\n")}\n    </image:image>`;
        })
        .join("\n");

      return `  <url>\n    <loc>${xmlEscape(`${siteUrl}${entry.path === "/" ? "" : entry.path}`)}</loc>\n${imageTags}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
};

const buildMerchantFeedXml = (products = []) => {
  const siteUrl = getSiteUrl();
  const feedBrand = process.env.MERCHANT_FEED_BRAND || "Maitrova";
  const shippingCountry = process.env.MERCHANT_FEED_SHIPPING_COUNTRY || "IN";
  const shippingService = process.env.MERCHANT_FEED_SHIPPING_SERVICE || "Standard";
  const shippingPrice = Number(process.env.MERCHANT_FEED_SHIPPING_PRICE || 0);
  const googleProductCategory =
    process.env.MERCHANT_FEED_GOOGLE_PRODUCT_CATEGORY ||
    "Apparel & Accessories > Clothing > Shirts & Tops";
  const buildPrice = (price, currency = "INR") =>
    `${Number(price || 0).toFixed(2)} ${String(currency || "INR").toUpperCase()}`;

  const items = products
    .map((rawProduct) => {
      const product = attachReadymadePricing({ ...rawProduct });
      const categoryName = product.category?.name || product.category || "";
      const subCategoryName = product.subCategory?.name || product.subCategory || "";
      const categorySlug = normalizeRouteSegment(categoryName);
      const subCategorySlug = normalizeRouteSegment(subCategoryName);
      const productSlug = normalizeRouteSegment(product.title);
      const link =
        categorySlug && subCategorySlug && productSlug
          ? `${siteUrl}/products/${categorySlug}/${subCategorySlug}/${productSlug}`
          : `${siteUrl}/readymade/${product._id}`;
      const images = uniqueImageEntries(
        [product.thumbnail, ...(product.images || [])]
          .map((image) => ({ loc: buildImageUrl(image) }))
          .filter((image) => image.loc)
      );
      const price = Number(product.mrp || product.price || product.effectivePrice || 0);
      const salePrice = Number(product.effectivePrice || product.finalPrice || price);
      const currency = product.currency || "INR";
      const availability =
        product.isActive && Number(product.stock || 0) > 0 ? "in stock" : "out of stock";
      const brandName = feedBrand;
      const productType =
        [categoryName, subCategoryName].filter(Boolean).join(" > ") || "Maitrova Products";
      const description =
        stripHtml(product.description) || `${product.title} from Maitrova`;

      const tags = [
        `<g:id>${xmlEscape(String(product._id))}</g:id>`,
        `<g:title>${xmlEscape(product.title)}</g:title>`,
        `<g:description>${xmlEscape(description.slice(0, 5000))}</g:description>`,
        `<g:link>${xmlEscape(link)}</g:link>`,
        images[0]?.loc ? `<g:image_link>${xmlEscape(images[0].loc)}</g:image_link>` : "",
        ...images.slice(1, 10).map((image) => `<g:additional_image_link>${xmlEscape(image.loc)}</g:additional_image_link>`),
        `<g:availability>${xmlEscape(availability)}</g:availability>`,
        `<g:price>${xmlEscape(buildPrice(price || salePrice, currency))}</g:price>`,
        product.saleActive && salePrice > 0 && salePrice < price
          ? `<g:sale_price>${xmlEscape(buildPrice(salePrice, currency))}</g:sale_price>`
          : "",
        `<g:condition>new</g:condition>`,
        `<g:brand>${xmlEscape(brandName)}</g:brand>`,
        `<g:product_type>${xmlEscape(productType)}</g:product_type>`,
        `<g:google_product_category>${xmlEscape(googleProductCategory)}</g:google_product_category>`,
        [
          "<g:shipping>",
          `  <g:country>${xmlEscape(shippingCountry)}</g:country>`,
          `  <g:service>${xmlEscape(shippingService)}</g:service>`,
          `  <g:price>${xmlEscape(buildPrice(shippingPrice, currency))}</g:price>`,
          "</g:shipping>",
        ].join("\n"),
        `<g:identifier_exists>no</g:identifier_exists>`,
      ].filter(Boolean);

      if (!product.title || !description || !images[0]?.loc || !(price || salePrice)) {
        return "";
      }

      return `    <item>\n${tags.map((tag) => `      ${tag}`).join("\n")}\n    </item>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Maitrova Products</title>\n    <link>${xmlEscape(siteUrl)}</link>\n    <description>Maitrova product feed for Google Merchant Center</description>\n${items}\n  </channel>\n</rss>\n`;
};

const buildReadymadeUrlAndImageEntries = async () => {
  const products = await ReadymadeProduct.find({ isActive: true })
    .populate("category", "name thumbnail altText")
    .populate("subCategory", "name thumbnail altText")
    .select("title thumbnail images updatedAt category subCategory")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const urlEntries = [];
  const imageEntries = [];
  const seenCategoryPaths = new Set();
  const seenSubCategoryPaths = new Set();
  const seenProductPaths = new Set();

  for (const product of products) {
    const categoryName = product.category?.name || product.category || "";
    const subCategoryName = product.subCategory?.name || product.subCategory || "";
    const categorySlug = normalizeRouteSegment(categoryName);
    const subCategorySlug = normalizeRouteSegment(subCategoryName);
    const productSlug = normalizeRouteSegment(product.title);

    if (!categorySlug || !subCategorySlug || !productSlug) continue;

    const categoryPath = `/products/${categorySlug}`;
    const subCategoryPath = `${categoryPath}/${subCategorySlug}`;
    const productPath = `${subCategoryPath}/${productSlug}`;

    if (!seenCategoryPaths.has(categoryPath)) {
      seenCategoryPaths.add(categoryPath);
      urlEntries.push(makeUrlEntry(categoryPath, product.updatedAt, 0.8, "weekly"));

      const categoryImage = buildImageUrl(product.category?.thumbnail);
      if (categoryImage) {
        imageEntries.push({
          path: categoryPath,
          images: [{ loc: categoryImage, title: product.category?.altText || categoryName }],
        });
      }
    }

    if (!seenSubCategoryPaths.has(subCategoryPath)) {
      seenSubCategoryPaths.add(subCategoryPath);
      urlEntries.push(makeUrlEntry(subCategoryPath, product.updatedAt, 0.7, "weekly"));

      const subCategoryImage = buildImageUrl(product.subCategory?.thumbnail);
      if (subCategoryImage) {
        imageEntries.push({
          path: subCategoryPath,
          images: [{ loc: subCategoryImage, title: product.subCategory?.altText || subCategoryName }],
        });
      }
    }

    if (!seenProductPaths.has(productPath)) {
      seenProductPaths.add(productPath);
      urlEntries.push(makeUrlEntry(productPath, product.updatedAt, 0.7, "weekly"));

      const productImages = uniqueImageEntries(
        [product.thumbnail, ...(product.images || [])]
          .map((image) => ({
            loc: buildImageUrl(image),
            title: image?.altText || product.title,
          }))
          .filter((image) => image.loc)
      );

      if (productImages.length) {
        imageEntries.push({ path: productPath, images: productImages });
      }
    }
  }

  return { urlEntries, imageEntries };
};

const buildDropUrlAndImageEntries = async () => {
  const products = await Dropproduct.find({ isActive: true })
    .select("name thumbnail images updatedAt")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const urlEntries = [];
  const imageEntries = [];

  for (const product of products) {
    const slug = slugifyDropProductName(product.name);
    if (!slug) continue;

    const path = `/trending/${slug}`;
    urlEntries.push(makeUrlEntry(path, product.updatedAt, 0.6, "weekly"));

    const images = uniqueImageEntries(
      [product.thumbnail, ...(product.images || [])]
        .map((image) => ({
          loc: buildImageUrl(image),
          title: product.name,
        }))
        .filter((image) => image.loc)
    );

    if (images.length) {
      imageEntries.push({ path, images });
    }
  }

  return { urlEntries, imageEntries };
};

const buildBlogUrlAndImageEntries = async () => {
  const blogs = await Blog.find({ isPublished: true })
    .select("slug title coverImage coverImageAlt sectionImages content updatedAt publishedAt")
    .sort({ publishedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean();

  const urlEntries = [];
  const imageEntries = [];

  for (const blog of blogs) {
    if (!blog.slug) continue;

    const path = `/blogs/${blog.slug}`;
    urlEntries.push(makeUrlEntry(path, blog.updatedAt || blog.publishedAt, 0.7, "monthly"));

    const images = uniqueImageEntries(
      [
        {
          loc: buildImageUrl(blog.coverImage),
          title: blog.coverImageAlt || blog.title,
        },
        ...(blog.sectionImages || []).map((image) => ({
          loc: buildImageUrl(image?.imageUrl),
          title: image?.altText || blog.title,
        })),
        ...parseInlineImageUrls(blog.content).map((imageUrl) => ({
          loc: buildImageUrl(imageUrl),
          title: blog.title,
        })),
      ].filter((image) => image.loc)
    );

    if (images.length) {
      imageEntries.push({ path, images });
    }
  }

  return { urlEntries, imageEntries };
};

const getSitemapData = async () => {
  const staticUrlEntries = [
    makeUrlEntry("/", new Date(), 1.0, "daily"),
    makeUrlEntry("/products", new Date(), 0.9, "daily"),
    makeUrlEntry("/catalogue", new Date(), 0.5, "weekly"),
    makeUrlEntry("/customproducts", new Date(), 0.5, "weekly"),
  ];

  const [readymadeData, dropData, blogData] = await Promise.all([
    buildReadymadeUrlAndImageEntries(),
    buildDropUrlAndImageEntries(),
    buildBlogUrlAndImageEntries(),
  ]);

  return {
    urlEntries: [
      ...staticUrlEntries,
      ...readymadeData.urlEntries,
      ...dropData.urlEntries,
      ...blogData.urlEntries,
    ],
    imageEntries: [
      ...readymadeData.imageEntries,
      ...dropData.imageEntries,
      ...blogData.imageEntries,
    ],
  };
};

export const getXmlSitemap = async (req, res) => {
  try {
    const { urlEntries } = await getSitemapData();
    const xml = buildSitemapXml(urlEntries);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("getXmlSitemap error:", error);
    return res.status(500).json({ message: "Failed to generate sitemap" });
  }
};

export const getImageSitemap = async (req, res) => {
  try {
    const { imageEntries } = await getSitemapData();
    const xml = buildImageSitemapXml(imageEntries);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("getImageSitemap error:", error);
    return res.status(500).json({ message: "Failed to generate image sitemap" });
  }
};

export const getProductFeed = async (req, res) => {
  try {
    const products = await ReadymadeProduct.find({ isActive: true })
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("brand", "name")
      .select("title description thumbnail images price salePrice saleStartAt saleEndAt currency stock variants category subCategory brand isActive updatedAt")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    const xml = buildMerchantFeedXml(products);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("getProductFeed error:", error);
    return res.status(500).json({ message: "Failed to generate product feed" });
  }
};

export const getRobotsTxt = async (req, res) => {
  try {
    const siteUrl = getSiteUrl();
    const sitemapUrl = `${siteUrl}/sitemap.xml`;
    const imageSitemapUrl = `${siteUrl}/image-sitemap.xml`;
    const body = [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${sitemapUrl}`,
      `Sitemap: ${imageSitemapUrl}`,
      "",
      `Host: ${siteUrl.replace(/^https?:\/\//i, "")}`,
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(`${body}\n`);
  } catch (error) {
    console.error("getRobotsTxt error:", error);
    return res.status(500).json({ message: "Failed to generate robots.txt" });
  }
};
