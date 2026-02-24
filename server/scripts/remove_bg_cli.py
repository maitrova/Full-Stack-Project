import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

# Get the root directory
script_dir = Path(__file__).parent
root_dir = script_dir.parent

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
        
        # Use rembg to remove background
        from rembg import remove
        from PIL import Image
        
        input_image = Image.open(input_path)
        output_image = remove(input_image)
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
