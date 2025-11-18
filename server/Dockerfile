# Use Node.js with Python support
FROM node:20-bullseye

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install Python dependencies
COPY recolor_tshirt.py ./
RUN pip3 install --no-cache-dir \
    rembg \
    Pillow \
    requests

# Copy application code
COPY . .

# Create output directory
RUN mkdir -p tshirt_recolor_output

# Expose port
EXPOSE 5000

# Set environment variable
ENV PORT=5000

# Start the server
CMD ["node", "server.js"]
