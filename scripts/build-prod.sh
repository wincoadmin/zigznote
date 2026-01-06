#!/bin/bash
set -e

echo "🔨 Building production Docker images..."

# Check required env vars
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "⚠️  NEXT_PUBLIC_API_URL not set, using default"
  export NEXT_PUBLIC_API_URL="http://localhost:3001"
fi

if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
  echo "⚠️  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set"
fi

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo "⚠️  NEXT_PUBLIC_APP_URL not set, using default"
  export NEXT_PUBLIC_APP_URL="http://localhost:3000"
fi

# Get git hash for tagging
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")

# Build API image
echo ""
echo "📦 Building API image..."
docker build \
  -f apps/api/Dockerfile \
  -t zigznote-api:latest \
  -t zigznote-api:$GIT_HASH \
  .

# Build Web image
echo ""
echo "📦 Building Web image..."
docker build \
  -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --build-arg NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
  -t zigznote-web:latest \
  -t zigznote-web:$GIT_HASH \
  .

echo ""
echo "✅ Build complete!"
echo ""
echo "Images created:"
docker images | grep zigznote | head -4
echo ""
echo "To run locally:"
echo "  docker-compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d"
echo ""
echo "To push to registry:"
echo "  docker tag zigznote-api:latest your-registry/zigznote-api:latest"
echo "  docker push your-registry/zigznote-api:latest"
echo "  docker tag zigznote-web:latest your-registry/zigznote-web:latest"
echo "  docker push your-registry/zigznote-web:latest"
