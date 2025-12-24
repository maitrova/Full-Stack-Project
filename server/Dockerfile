# Use Node.js slim image with Python support
FROM node:20-bullseye-slim

WORKDIR /app

# Install only runtime dependencies (reduced layer size)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files
COPY package*.json ./

# Install Node.js dependencies and clean npm cache
RUN npm ci --only=production && npm cache clean --force

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies with optimizations
RUN pip3 install --no-cache-dir --upgrade pip \
    && pip3 install --no-cache-dir -r requirements.txt \
    && find /usr/local/lib/python3.* -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.* -type d -name 'tests' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.* -type d -name '*.dist-info' -exec rm -rf {}/RECORD {} + 2>/dev/null || true

# Copy application code
COPY . .

# Create output directories
RUN mkdir -p tshirt_recolor_output outputs/designs

# Expose port
EXPOSE 5000

# Set environment variable
ENV PORT=5000 \
    NODE_ENV=production \
    PYTHONUNBUFFERED=1

# Start the server
CMD ["node", "server.js"]