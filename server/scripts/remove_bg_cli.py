import os
import sys
from pathlib import Path
from collections import deque

# Get the root directory
script_dir = Path(__file__).parent
root_dir = script_dir.parent


def remove_interior_background(rgba_image):
    """
    rembg removes the outer background but leaves interior holes opaque
    (e.g. inside letters, enclosed shapes, gaps between limbs).

    This BFS flood-fill post-process finds every transparent region that is
    NOT connected to the image border and makes it transparent too.

    Uses only numpy (already a rembg/onnxruntime dependency — no extra install).
    """
    import numpy as np

    data = np.array(rgba_image)          # H x W x 4  (RGBA)
    alpha = data[:, :, 3]
    h, w = alpha.shape

    # A pixel is "background" if rembg already made it transparent
    is_bg = alpha < 128

    # BFS from every border pixel that is already transparent
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    def enqueue(r, c):
        if is_bg[r, c] and not visited[r, c]:
            visited[r, c] = True
            queue.append((r, c))

    for col in range(w):
        enqueue(0, col)
        enqueue(h - 1, col)
    for row in range(h):
        enqueue(row, 0)
        enqueue(row, w - 1)

    while queue:
        r, c = queue.popleft()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w:
                enqueue(nr, nc)

    # Interior background = transparent BUT not reachable from the border
    interior_bg = is_bg & ~visited
    data[interior_bg, 3] = 0

    from PIL import Image
    return Image.fromarray(data, "RGBA")


def remove_bg_cli(input_path, output_path):
    """Remove background from image using rembg library"""
    try:
        if not os.path.exists(input_path):
            print(f"Error: Input file not found: {input_path}", file=sys.stderr)
            return False

        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        print(f"Processing file: {input_path}")
        print(f"Output path: {output_path}")

        from rembg import remove
        from PIL import Image

        input_image = Image.open(input_path)

        # Step 1: rembg removes outer background
        output_image = remove(input_image)

        # Step 2: flood-fill post-process removes interior background holes
        output_image = remove_interior_background(output_image)

        output_image.save(output_path)

        print(f"Successfully removed background: {output_path}")
        return True

    except Exception as e:
        print(f"Error removing background: {str(e)}", file=sys.stderr)
        return False


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg_cli.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    success = remove_bg_cli(input_path, output_path)
    sys.exit(0 if success else 1)
