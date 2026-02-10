#!/bin/bash

echo "🚀 Setting up Pump Intervention Manager..."
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name initial_setup

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with your database credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to create your admin account"
