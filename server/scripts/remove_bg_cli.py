import os
import sys
from pathlib import Path
from collections import deque

script_dir = Path(__file__).parent
root_dir = script_dir.parent


def fill_interior_background(original_image, rembg_image, tolerance=45):
    """
    rembg removes the outer background but leaves interior holes opaque because
    the neural net scores enclosed background regions (e.g. inside letters like
    'o','a','d', gaps in logos, space between arm and body) as foreground.
    Those pixels still have alpha=255 in the rembg output — a pure alpha-channel
    flood-fill cannot find them.

    Fix: BFS flood-fill on the ORIGINAL image's RGB colors starting from every
    border pixel.  Any pixel whose color is within `tolerance` of the sampled
    background color AND is connected to the border (including through interior
    holes) gets made transparent in the final result.

    Uses only numpy + PIL — both already installed as rembg dependencies.
    """
    import numpy as np

    # Work in float for distance calculations
    orig = np.array(original_image.convert("RGBA"), dtype=np.float32)
    result = np.array(rembg_image, dtype=np.uint8)   # RGBA
    h, w = result.shape[:2]

    # --- Estimate background color from a strip around the image border ---
    border_pixels = np.concatenate([
        orig[0, :, :3],          # top row
        orig[h - 1, :, :3],      # bottom row
        orig[:, 0, :3],          # left column
        orig[:, w - 1, :3],      # right column
    ], axis=0)
    bg_color = np.median(border_pixels, axis=0)  # robust to noisy borders

    # --- Euclidean RGB distance from background color ---
    diff = orig[:, :, :3] - bg_color[np.newaxis, np.newaxis, :]
    dist = np.sqrt(np.sum(diff ** 2, axis=2))    # shape H x W

    # A pixel "looks like background" if its color is within tolerance
    looks_like_bg = dist < tolerance

    # --- BFS from every border pixel that looks like background ---
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

    # --- Make all visited (BFS-reachable background) pixels transparent ---
    result[visited, 3] = 0

    # --- Also preserve anything rembg already made transparent ---
    rembg_arr = np.array(rembg_image, dtype=np.uint8)
    result[rembg_arr[:, :, 3] < 128, 3] = 0

    from PIL import Image
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
