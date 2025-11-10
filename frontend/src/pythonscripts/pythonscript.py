# =============================================
# CUSTOMINK-STYLE T-SHIRT RECOLOR PIPELINE (FIXED)
# =============================================

from rembg import remove
from PIL import Image, ImageEnhance, ImageOps, ImageChops
import requests
from io import BytesIO
import os

# -----------------------------
# CONFIG
# -----------------------------
image_url = "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRzWQ7iAlYG4V9obJqDIUiTRmEV_tsYxi5mYg5E-ssCNRiXpAB4IsnagH2gcH7kEfTKgfGNP90W0pRs4pTTA0uPmmHX-su_fGimRbMLw3-8jEWcgjIndsk4nhA"

# 🎨 Choose your color in RGB format
target_color = (0, 128, 255)  # light blue

output_folder = "tshirt_recolor_output"
os.makedirs(output_folder, exist_ok=True)

# -----------------------------
# 1️⃣ Download Image
# -----------------------------
print("📥 Downloading image...")
img = Image.open(BytesIO(requests.get(image_url).content)).convert("RGBA")

# -----------------------------
# 2️⃣ Remove Background
# -----------------------------
print("🧼 Removing background...")
result = remove(img)

# Handle both possible return types (bytes or Image)
if isinstance(result, Image.Image):
    base = result.convert("RGBA")
else:
    base = Image.open(BytesIO(result)).convert("RGBA")

base.save(os.path.join(output_folder, "base_transparent.png"))

# -----------------------------
# 3️⃣ Create Shading Overlay
# -----------------------------
print("🩶 Creating shading overlay (preserve wrinkles & shadows)...")

overlay = ImageOps.grayscale(base)
overlay = ImageEnhance.Contrast(overlay).enhance(1.8)
overlay = ImageEnhance.Brightness(overlay).enhance(1.2)

overlay = overlay.convert("RGBA")
overlay.putalpha(base.split()[-1])
overlay.save(os.path.join(output_folder, "overlay_texture.png"))

# -----------------------------
# 4️⃣ Apply New Color
# -----------------------------
print("🎨 Applying color...")
color_layer = Image.new("RGBA", base.size, target_color + (255,))

colored = ImageChops.multiply(color_layer, overlay)
final = Image.new("RGBA", base.size)
final = Image.alpha_composite(final, colored)

final.save(os.path.join(output_folder, "tshirt_colored.png"))

print("\n✅ Done! Files generated:")
print(f"   - {output_folder}/base_transparent.png")
print(f"   - {output_folder}/overlay_texture.png")
print(f"   - {output_folder}/tshirt_colored.png  ← final recolored shirt")


# =============================================
# CUSTOMINK-STYLE T-SHIRT RECOLOR PIPELINE (FIXED)
# =============================================

from rembg import remove
from PIL import Image, ImageEnhance, ImageOps, ImageChops
import requests
from io import BytesIO
import os

# -----------------------------
# CONFIG
# -----------------------------
image_url = "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRzWQ7iAlYG4V9obJqDIUiTRmEV_tsYxi5mYg5E-ssCNRiXpAB4IsnagH2gcH7kEfTKgfGNP90W0pRs4pTTA0uPmmHX-su_fGimRbMLw3-8jEWcgjIndsk4nhA"

# 🎨 Choose your color in RGB format
target_color = (0, 128, 255)  # light blue

output_folder = "tshirt_recolor_output"
os.makedirs(output_folder, exist_ok=True)

# -----------------------------
# 1️⃣ Download Image
# -----------------------------
print("📥 Downloading image...")
img = Image.open(BytesIO(requests.get(image_url).content)).convert("RGBA")

# -----------------------------
# 2️⃣ Remove Background
# -----------------------------
print("🧼 Removing background...")
result = remove(img)

# Handle both possible return types (bytes or Image)
if isinstance(result, Image.Image):
    base = result.convert("RGBA")
else:
    base = Image.open(BytesIO(result)).convert("RGBA")

base.save(os.path.join(output_folder, "base_transparent.png"))

# -----------------------------
# 3️⃣ Create Shading Overlay
# -----------------------------
print("🩶 Creating shading overlay (preserve wrinkles & shadows)...")

overlay = ImageOps.grayscale(base)
overlay = ImageEnhance.Contrast(overlay).enhance(1.8)
overlay = ImageEnhance.Brightness(overlay).enhance(1.2)

overlay = overlay.convert("RGBA")
overlay.putalpha(base.split()[-1])
overlay.save(os.path.join(output_folder, "overlay_texture.png"))

# -----------------------------
# 4️⃣ Apply New Color
# -----------------------------
print("🎨 Applying color...")
color_layer = Image.new("RGBA", base.size, target_color + (255,))

colored = ImageChops.multiply(color_layer, overlay)
final = Image.new("RGBA", base.size)
final = Image.alpha_composite(final, colored)

final.save(os.path.join(output_folder, "tshirt_colored.png"))

print("\n✅ Done! Files generated:")
print(f"   - {output_folder}/base_transparent.png")
print(f"   - {output_folder}/overlay_texture.png")
print(f"   - {output_folder}/tshirt_colored.png  ← final recolored shirt")
