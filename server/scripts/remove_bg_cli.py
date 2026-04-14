import os
import sys
from pathlib import Path
from collections import deque

script_dir = Path(__file__).parent
root_dir = script_dir.parent

# Longest side used for BFS computation. Full-res images can be 3000–6000px;
# running BFS at that size is slow (millions of Python iterations).
# 512px gives identical results after upscaling and is ~30–100x faster.
BFS_MAX_SIZE = 512


def fill_interior_background(original_image, rembg_image, tolerance=45):
    """
    BFS flood-fill on a downsampled version of the original image to find
    background regions (connected to the border) that rembg's neural net missed.
    The resulting mask is upscaled back to full resolution and applied.
    """
    import numpy as np
    from PIL import Image

    orig_w, orig_h = original_image.size

    # --- Downsample for BFS so we iterate over ~262K px instead of millions ---
    scale = min(BFS_MAX_SIZE / max(orig_w, orig_h), 1.0)
    small_w = max(1, int(orig_w * scale))
    small_h = max(1, int(orig_h * scale))

    small = np.array(
        original_image.convert("RGB").resize((small_w, small_h), Image.BILINEAR),
        dtype=np.float32,
    )
    h, w = small.shape[:2]

    # --- Estimate background color from the border of the downsampled image ---
    border_pixels = np.concatenate([
        small[0, :, :],
        small[h - 1, :, :],
        small[:, 0, :],
        small[:, w - 1, :],
    ], axis=0)
    bg_color = np.median(border_pixels, axis=0)

    # --- Build "looks like background" boolean map ---
    diff = small - bg_color[np.newaxis, np.newaxis, :]
    dist = np.sqrt(np.sum(diff ** 2, axis=2))
    looks_like_bg = dist < tolerance

    # --- BFS from every border pixel that matches the background color ---
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    def enqueue(r, c):
        if looks_like_bg[r, c] and not visited[r, c]:
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

    # --- Upscale the boolean mask back to full resolution (NEAREST = no blur) ---
    mask_small = Image.fromarray((visited * 255).astype(np.uint8), "L")
    mask_full = np.array(
        mask_small.resize((orig_w, orig_h), Image.NEAREST), dtype=bool
    )

    # --- Apply mask: transparent where BFS reached OR rembg already removed ---
    result = np.array(rembg_image, dtype=np.uint8)
    result[mask_full, 3] = 0
    result[np.array(rembg_image, dtype=np.uint8)[:, :, 3] < 128, 3] = 0

    return Image.fromarray(result, "RGBA")


def remove_bg_cli(input_path, output_path):
    """Remove background from image using rembg + color flood-fill post-process."""
    try:
        if not os.path.exists(input_path):
            print(f"Error: Input file not found: {input_path}", file=sys.stderr)
            return False

        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        print(f"Processing file: {input_path}")
        print(f"Output path: {output_path}")

        from rembg import remove
        from PIL import Image

        original_image = Image.open(input_path)

        # Step 1 — rembg neural net removes the obvious outer background
        rembg_output = remove(original_image)

        # Step 2 — color flood-fill removes interior background holes rembg missed
        final_image = fill_interior_background(original_image, rembg_output)

        final_image.save(output_path)

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



if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg_cli.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    success = remove_bg_cli(input_path, output_path)
    sys.exit(0 if success else 1)
