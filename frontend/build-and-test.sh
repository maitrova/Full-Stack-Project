#!/bin/bash

# Build and test script for the frontend

set -e

echo "🔨 Building production Docker image..."
docker build -t maitrova/maitrova:frontend .

echo "🧪 Testing the built image..."
# Run container in background
CONTAINER_ID=$(docker run -d -p 8080:80 \
  -e VITE_API_URL=https://narifighter.online/backend \
  maitrova/maitrova:frontend)

echo "⏳ Waiting for container to start..."
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:8080/health; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  docker logs $CONTAINER_ID
  docker stop $CONTAINER_ID
  docker rm $CONTAINER_ID
  exit 1
fi

# Test main page
echo "🌐 Testing main page..."
if curl -f http://localhost:8080/ > /dev/null; then
  echo "✅ Main page accessible"
else
  echo "❌ Main page failed"
  docker logs $CONTAINER_ID
  docker stop $CONTAINER_ID
  docker rm $CONTAINER_ID
  exit 1
fi

echo "🧹 Cleaning up..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID

echo "✅ Build and tests completed successfully!"
echo "📦 Image size:"
docker images maitrova/maitrova:frontend --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"