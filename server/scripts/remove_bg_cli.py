from rembg import remove
from PIL import Image
import sys
import os

"""
Usage:
python scripts/remove_bg_cli.py <input_path> <output_path>
"""

input_path = sys.argv[1]
output_path = sys.argv[2]

img = Image.open(input_path).convert("RGBA")
result = remove(img)

# result can be Image or bytes
if isinstance(result, Image.Image):
    final = result.convert("RGBA")
else:
    from io import BytesIO
    final = Image.open(BytesIO(result)).convert("RGBA")

final.save(output_path)
print("DONE")
