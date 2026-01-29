# Use Node.js with Python support
FROM node:18-slim

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    libffi-dev \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libglib2.0-0 \
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

# Create required directories
RUN mkdir -p /app/outputs/designs
RUN mkdir -p /app/outputs/dropimages
RUN mkdir -p /app/outputs/adminuploadeddesigns
RUN mkdir -p /app/outputs/readymade-products
RUN mkdir -p /app/uploads
RUN mkdir -p /app/scripts

# Ensure Python script has execute permissions
RUN chmod +x /app/scripts/remove_bg_cli.py || true

# Expose port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]