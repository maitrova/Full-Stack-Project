# Custom Try-On Endpoint Contract

Use this when you want free or self-run inference from Google Colab, Kaggle, RunPod, or your own GPU box instead of Replicate.

## Backend env

```env
TRYON_PROVIDER=custom
CUSTOM_TRYON_ENDPOINT_URL=https://your-endpoint.example.com/tryon
# optional
CUSTOM_TRYON_AUTH_TOKEN=your_token
```

## Request payload sent by this backend

```json
{
  "userImageUrl": "https://public-host/api/outputs/virtual-tryon/inputs/user/...",
  "garmentImageUrl": "https://public-host/api/outputs/virtual-tryon/inputs/garment/...",
  "metadata": {
    "productId": "....",
    "productSlug": "....",
    "productName": "Customized T-Shirt",
    "productColor": "#ffffff",
    "productColorName": "White",
    "selectedSize": "M",
    "selectedQuantity": 1,
    "garmentCategory": "upper_body",
    "views": ["front", "back"],
    "customization": {
      "designLayerCount": 1,
      "textLayerCount": 0,
      "activeView": "front"
    }
  }
}
```

## Accepted response shapes

Any one of these keys can contain the final image URL:

```json
{ "previewImage": "https://..." }
```

```json
{ "image": "https://..." }
```

```json
{ "output": "https://..." }
```

You can also return raw image bytes instead of JSON.

## Important

The returned image URL must be publicly reachable by this backend if the backend needs to download and persist it.
