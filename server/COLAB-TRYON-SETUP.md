# Colab Try-On Setup

This is the zero-payment route for real try-on testing.

## What this gives you

- your app backend already knows how to call a custom endpoint
- this repo now includes a Colab/Kaggle-ready server script:
  [server/colab/custom_tryon_endpoint.py](/d:/ai/Full-Stack-Project/server/colab/custom_tryon_endpoint.py)

## What you still need

You need a temporary GPU notebook runtime with:

1. the try-on model code
2. an HTTP endpoint
3. a way to return a public image URL

## Minimum flow

1. Open Google Colab
2. Enable GPU runtime
3. Clone the official CatVTON repo:

```python
!git clone https://github.com/Zheng-Chong/CatVTON.git
%cd CatVTON
```

4. Install dependencies:

```python
!pip install fastapi uvicorn pyngrok requests pillow python-multipart cloudinary
!pip install -r requirements.txt
```

5. Set notebook env vars:

```python
import os
os.environ["CATVTON_REPO_PATH"] = "/content/CatVTON"
os.environ["CATVTON_MIXED_PRECISION"] = "bf16"
os.environ["CATVTON_WIDTH"] = "768"
os.environ["CATVTON_HEIGHT"] = "1024"
```

6. Optional but recommended: configure Cloudinary so the notebook can return a public image URL:

```python
os.environ["CLOUDINARY_CLOUD_NAME"] = "..."
os.environ["CLOUDINARY_API_KEY"] = "..."
os.environ["CLOUDINARY_API_SECRET"] = "..."
```

7. Save or paste [server/colab/custom_tryon_endpoint.py](/d:/ai/Full-Stack-Project/server/colab/custom_tryon_endpoint.py) into the notebook workspace, then run:

```python
!python custom_tryon_endpoint.py
```

8. Expose port `8000` with `pyngrok`:

```python
from pyngrok import ngrok
tunnel = ngrok.connect(8000)
print(tunnel.public_url)
```

9. Put the tunnel URL into your backend env:

```env
TRYON_PROVIDER=custom
CUSTOM_TRYON_ENDPOINT_URL=https://your-colab-ngrok-url/tryon
```

## Current behavior

The endpoint now tries to run real CatVTON first.

If CatVTON is not installed correctly or fails to initialize, it falls back to the debug preview.

## Returning a public image URL

Your app backend expects the custom endpoint to return a public image URL.

The script supports optional Cloudinary upload if these env vars are set in Colab:

```python
import os
os.environ["CLOUDINARY_CLOUD_NAME"] = "..."
os.environ["CLOUDINARY_API_KEY"] = "..."
os.environ["CLOUDINARY_API_SECRET"] = "..."
```

Then the endpoint will return:

```json
{ "previewImage": "https://..." }
```

## Endpoint contract

Request:

```json
{
  "userImageUrl": "https://...",
  "garmentImageUrl": "https://...",
  "metadata": {}
}
```

Response:

```json
{
  "previewImage": "https://..."
}
```

## Practical note

This is useful for testing and experimentation, not for stable production:

- Colab sessions expire
- ngrok URLs change
- free GPU availability is inconsistent

This setup is based on the official CatVTON repo:
- GitHub: https://github.com/Zheng-Chong/CatVTON
- Hugging Face weights: https://huggingface.co/zhengchong/CatVTON
