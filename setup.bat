@echo off
echo 🚀 Setting up Pump Intervention Manager...
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Generate Prisma client
echo 🔧 Generating Prisma client...
call npx prisma generate

REM Run migrations
echo 🗄️  Running database migrations...
call npx prisma migrate dev --name initial_setup

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update your .env file with your database credentials
echo 2. Run 'npm run dev' to start the development server
echo 3. Visit http://localhost:3000 to create your admin account
pause
