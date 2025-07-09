#!/bin/bash
# Lambda deployment package build script

set -e

echo "🔨 Building Lambda deployment package..."

# Clean up previous build
rm -rf lambda-dist
rm -f lambda-dist.zip

# Build TypeScript
echo "📦 Compiling TypeScript..."
npx tsc -p tsconfig.build.json

# Create deployment directory
mkdir -p lambda-dist

# Copy compiled JavaScript files
cp -r dist/* lambda-dist/

# Copy package files
cp package.json package-lock.json lambda-dist/

# Install production dependencies
echo "📦 Installing production dependencies..."
cd lambda-dist
npm ci --production

# Remove only package-lock.json (keep package.json for ES module support)
rm -f package-lock.json

# Create zip file
echo "🗜️  Creating deployment package..."
cd ..
zip -r lambda-dist.zip lambda-dist

echo "✅ Lambda deployment package created: lambda-dist.zip"
echo "📊 Package size: $(du -h lambda-dist.zip | cut -f1)"