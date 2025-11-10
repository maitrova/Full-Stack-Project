#!/usr/bin/env python3
from rembg import remove
from PIL import Image, ImageEnhance, ImageOps, ImageChops
import requests
from io import BytesIO
import os
import sys
import json
import base64

def recolor_tshirt(image_url, target_color, output_folder="tshirt_recolor_output", save_file=False):
    try:
        
        print(f"Starting recolor_tshirt with URL: {image_url}, color: {target_color}", file=sys.stderr)
        # Create output folder only if saving
        if save_file:
            os.makedirs(output_folder, exist_ok=True)

        # 1. Download Image
        img = Image.open(BytesIO(requests.get(image_url).content)).convert("RGBA")

        # 2. Remove Background
        result = remove(img)

        # Handle both possible return types (bytes or Image)
        if isinstance(result, Image.Image):
            base = result.convert("RGBA")
        else:
            base = Image.open(BytesIO(result)).convert("RGBA")

        # Save base image only if requested
        if save_file:
            base_path = os.path.join(output_folder, "base_transparent.png")
            base.save(base_path)

        # 3. Create Shading Overlay
        overlay = ImageOps.grayscale(base)
        overlay = ImageEnhance.Contrast(overlay).enhance(1.8)
        overlay = ImageEnhance.Brightness(overlay).enhance(1.2)

        overlay = overlay.convert("RGBA")
        overlay.putalpha(base.split()[-1])
        
        if save_file:
            overlay_path = os.path.join(output_folder, "overlay_texture.png")
            overlay.save(overlay_path)

        # 4. Apply New Color
        color_layer = Image.new("RGBA", base.size, target_color + (255,))

        colored = ImageChops.multiply(color_layer, overlay)
        final = Image.new("RGBA", base.size)
        final = Image.alpha_composite(final, colored)

        # Save final image only if requested
        if save_file:
            final_path = os.path.join(output_folder, "tshirt_colored.png")
            final.save(final_path)

        # Convert final image to base64 for response
        buffered = BytesIO()
        final.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode()

        return {
            "success": True,
            "base64_image": img_base64,
            "image_url": image_url,
            "target_color": target_color,
            "saved": save_file
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # Read input from command line arguments
    if len(sys.argv) > 2:
        image_url = sys.argv[1]
        color_str = sys.argv[2]
        
        # Parse color
        try:
            color_parts = [int(x.strip()) for x in color_str.split(',')]
            if len(color_parts) == 3:
                target_color = tuple(color_parts)
            elif len(color_parts) == 4:
                target_color = tuple(color_parts[:3])
            else:
                result = {"success": False, "error": "Invalid color format. Expected 'r,g,b'"}
                print(json.dumps(result))
                sys.exit(1)
        except ValueError as e:
            result = {"success": False, "error": f"Invalid color format: {str(e)}"}
            print(json.dumps(result))
            sys.exit(1)
        
        # Optional output folder and save flag
        output_folder = sys.argv[3] if len(sys.argv) > 3 else "tshirt_recolor_output"
        save_file = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else False
        
        result = recolor_tshirt(image_url, target_color, output_folder, save_file)
        print(json.dumps(result))
        
    else:
        result = {
            "success": False, 
            "error": "Usage: python recolor_tshirt.py <image_url> <r,g,b> [output_folder] [save_file]"
        }
        print(json.dumps(result))