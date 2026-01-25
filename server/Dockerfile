# Use Node.js with Python support
FROM node:18-alpine

WORKDIR /app

# Install Python and dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    libffi-dev \
    jpeg-dev \
    zlib-dev \
    libpng-dev \
    glib-dev

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Python packages
RUN pip3 install --no-cache-dir \
    rembg \
    Pillow \
    requests \
    onnxruntime

# Copy application code
COPY . .

# Create output directory

RUN mkdir -p /app/outputs/designs
RUN mkdir -p /app/outputs/dropimages
RUN mkdir -p /app/outputs/adminuploadeddesigns
RUN mkdir -p /app/outputs/readymade-products
# Expose port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]