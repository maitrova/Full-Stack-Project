# Use Node.js with Python support
FROM node:18-slim

WORKDIR /app

# Install Python plus Chromium runtime libraries required by Puppeteer/Chrome
RUN apt-get update && apt-get install -y \
    ca-certificates \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    fonts-liberation \
    libffi-dev \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libjpeg-dev \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    zlib1g-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Python packages
RUN pip3 install --no-cache-dir --break-system-packages \
    rembg \
    Pillow \
    requests \
    onnxruntime

# Copy application code
COPY . .

# Pre-download the rembg u2net model (~170MB) so the first request doesn't pay the download cost
RUN python3 -c "\
from rembg import remove; \
from PIL import Image; \
import io; \
img = Image.new('RGB', (10, 10), color=(128, 128, 128)); \
remove(img); \
print('rembg model pre-loaded successfully')" || true

# Create required directories
RUN mkdir -p /app/outputs/designs
RUN mkdir -p /app/outputs/dropimages
RUN mkdir -p /app/outputs/adminuploadeddesigns
RUN mkdir -p /app/outputs/readymade-products
RUN mkdir -p /app/outputs/returns
RUN mkdir -p /app/uploads
RUN mkdir -p /app/scripts

# Ensure Python script has execute permissions
RUN chmod +x /app/scripts/remove_bg_cli.py || true

# Expose port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]
