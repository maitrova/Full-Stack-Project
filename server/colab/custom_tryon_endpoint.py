"""
Colab/Kaggle-ready custom try-on endpoint.

This script exposes the contract expected by:
server/services/virtualTryOnService.js

If the official CatVTON repo is cloned and CATVTON_REPO_PATH is set,
this script will try to run real CatVTON inference.
Otherwise it falls back to a labeled debug preview.

Suggested notebook installs:
!pip install fastapi uvicorn pyngrok requests pillow python-multipart cloudinary
!pip install -r requirements.txt   # from the CatVTON repo directory
"""

from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field


class TryOnRequest(BaseModel):
    userImageUrl: str = Field(..., min_length=1)
    garmentImageUrl: str = Field(..., min_length=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


app = FastAPI(title="Custom Try-On Endpoint")
_CATVTON_CONTEXT: Optional[Dict[str, Any]] = None


def download_image(url: str) -> Image.Image:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def create_debug_preview(
    user_image: Image.Image,
    garment_image: Image.Image,
    metadata: Dict[str, Any],
) -> Image.Image:
    canvas_width = 1280
    canvas_height = 1600
    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    user_copy = user_image.copy()
    user_copy.thumbnail((860, 1160))
    garment_copy = garment_image.copy()
    garment_copy.thumbnail((320, 320))

    canvas.paste(user_copy, (110, 220))
    canvas.paste(garment_copy, (900, 220))

    title = "Custom Try-On Endpoint"
    subtitle = metadata.get("productName", "Customized T-Shirt")
    warning = "Fallback preview only. CatVTON repo not initialized."

    draw.rectangle((40, 40, canvas_width - 40, canvas_height - 40), outline="#cbd5e1", width=3)
    draw.text((80, 80), title, fill="#0f172a", font=font)
    draw.text((80, 120), subtitle, fill="#475569", font=font)
    draw.text((80, canvas_height - 100), warning, fill="#b45309", font=font)

    return canvas


def save_local_output(image: Image.Image) -> Path:
    output_dir = Path(tempfile.gettempdir()) / "custom_tryon_outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "tryon_result.png"
    image.save(output_path, format="PNG")
    return output_path


def get_cloth_type_from_metadata(metadata: Dict[str, Any]) -> str:
    category = str(metadata.get("garmentCategory", "upper_body")).strip().lower()
    mapping = {
        "upper_body": "upper",
        "upper": "upper",
        "lower_body": "lower",
        "lower": "lower",
        "overall": "overall",
        "dress": "overall",
    }
    return mapping.get(category, "upper")


def upload_result_if_configured(output_path: Path) -> Optional[str]:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

    if not (cloud_name and api_key and api_secret):
        return None

    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
        )

        uploaded = cloudinary.uploader.upload(str(output_path), folder="custom-tryon")
        return uploaded.get("secure_url")
    except Exception as exc:
        print(f"Cloudinary upload failed: {exc}")
        return None


def get_catvton_context() -> Optional[Dict[str, Any]]:
    global _CATVTON_CONTEXT
    if _CATVTON_CONTEXT is not None:
        return _CATVTON_CONTEXT

    repo_path = os.getenv("CATVTON_REPO_PATH", "").strip()
    if not repo_path:
        _CATVTON_CONTEXT = None
        return None

    repo_dir = Path(repo_path).expanduser().resolve()
    if not repo_dir.exists():
        _CATVTON_CONTEXT = None
        return None

    if str(repo_dir) not in sys.path:
        sys.path.insert(0, str(repo_dir))

    try:
        import torch
        from diffusers.image_processor import VaeImageProcessor
        from huggingface_hub import snapshot_download
        from model.cloth_masker import AutoMasker
        from model.pipeline import CatVTONPipeline
        from utils import init_weight_dtype, resize_and_crop, resize_and_padding
    except Exception as exc:
        print(f"CatVTON import failed: {exc}")
        _CATVTON_CONTEXT = None
        return None

    if not torch.cuda.is_available():
        print("CatVTON requires CUDA; no GPU is available.")
        _CATVTON_CONTEXT = None
        return None

    base_model_path = os.getenv("CATVTON_BASE_MODEL_PATH", "runwayml/stable-diffusion-inpainting")
    resume_path = os.getenv("CATVTON_RESUME_PATH", "zhengchong/CatVTON")
    mixed_precision = os.getenv("CATVTON_MIXED_PRECISION", "bf16")
    width = int(os.getenv("CATVTON_WIDTH", "768"))
    height = int(os.getenv("CATVTON_HEIGHT", "1024"))
    allow_tf32 = os.getenv("CATVTON_ALLOW_TF32", "true").strip().lower() == "true"

    repo_weights = snapshot_download(repo_id=resume_path)
    pipeline = CatVTONPipeline(
        base_ckpt=base_model_path,
        attn_ckpt=repo_weights,
        attn_ckpt_version="mix",
        weight_dtype=init_weight_dtype(mixed_precision),
        use_tf32=allow_tf32,
        device="cuda",
    )
    mask_processor = VaeImageProcessor(
        vae_scale_factor=8,
        do_normalize=False,
        do_binarize=True,
        do_convert_grayscale=True,
    )
    automasker = AutoMasker(
        densepose_ckpt=os.path.join(repo_weights, "DensePose"),
        schp_ckpt=os.path.join(repo_weights, "SCHP"),
        device="cuda",
    )

    _CATVTON_CONTEXT = {
        "torch": torch,
        "pipeline": pipeline,
        "mask_processor": mask_processor,
        "automasker": automasker,
        "resize_and_crop": resize_and_crop,
        "resize_and_padding": resize_and_padding,
        "width": width,
        "height": height,
    }
    return _CATVTON_CONTEXT


def run_catvton_pipeline(
    user_image: Image.Image,
    garment_image: Image.Image,
    metadata: Dict[str, Any],
) -> Optional[Image.Image]:
    context = get_catvton_context()
    if not context:
        return None

    torch = context["torch"]
    pipeline = context["pipeline"]
    mask_processor = context["mask_processor"]
    automasker = context["automasker"]
    resize_and_crop = context["resize_and_crop"]
    resize_and_padding = context["resize_and_padding"]
    width = context["width"]
    height = context["height"]

    person_image = resize_and_crop(user_image.convert("RGB"), (width, height))
    cloth_image = resize_and_padding(garment_image.convert("RGB"), (width, height))
    cloth_type = get_cloth_type_from_metadata(metadata)

    mask = automasker(person_image, cloth_type)["mask"]
    mask = mask_processor.blur(mask, blur_factor=9)

    seed_value = metadata.get("seed")
    generator = None
    if seed_value is not None:
        try:
            generator = torch.Generator(device="cuda").manual_seed(int(seed_value))
        except Exception:
            generator = None

    num_inference_steps = int(
        metadata.get("numInferenceSteps", os.getenv("CATVTON_NUM_INFERENCE_STEPS", "50"))
    )
    guidance_scale = float(
        metadata.get("guidanceScale", os.getenv("CATVTON_GUIDANCE_SCALE", "2.5"))
    )

    result_image = pipeline(
        image=person_image,
        condition_image=cloth_image,
        mask=mask,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )[0]

    return result_image


def run_tryon_pipeline(
    user_image: Image.Image,
    garment_image: Image.Image,
    metadata: Dict[str, Any],
) -> tuple[Image.Image, str, Optional[str]]:
    catvton_result = run_catvton_pipeline(user_image, garment_image, metadata)
    if catvton_result is not None:
        return catvton_result, "ai", None

    return (
        create_debug_preview(user_image, garment_image, metadata),
        "mock",
        "CatVTON did not initialize, so the endpoint returned a fallback preview instead of a fitted try-on.",
    )


@app.post("/tryon")
def tryon(payload: TryOnRequest):
    try:
        user_image = download_image(payload.userImageUrl)
        garment_image = download_image(payload.garmentImageUrl)
        result_image, result_mode, result_warning = run_tryon_pipeline(
            user_image, garment_image, payload.metadata
        )
        output_path = save_local_output(result_image)
        public_url = upload_result_if_configured(output_path)

        if public_url:
            response_payload = {
                "previewImage": public_url,
                "provider": "custom",
                "mode": result_mode,
            }
            if result_warning:
                response_payload["warning"] = result_warning
            return JSONResponse(response_payload)

        return JSONResponse(
            {
                "error": (
                    "Try-on image generated inside the notebook, but no public upload is configured. "
                    "Set Cloudinary credentials or return your own hosted URL."
                )
            },
            status_code=500,
        )
    except requests.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to download source images: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
