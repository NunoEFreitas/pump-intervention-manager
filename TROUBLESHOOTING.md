# Troubleshooting Guide

## "Couldn't find next-intl config file" Error

If you see this error after starting the dev server:

```
Error: Couldn't find next-intl config file
```

### Solution 1: Clean Restart (Most Common Fix)

```bash
# Stop the dev server (Ctrl+C)

# Delete build cache
rm -rf .next

# Or on Windows:
# rmdir /s /q .next

# Restart dev server
npm run dev
```

### Solution 2: Verify File Structure

Make sure you have these files:

```
i18n/
├── request.ts
└── routing.ts

messages/
├── en.json
├── pt.json
└── es.json

next.config.mjs
middleware.ts
```

### Solution 3: Clean Install

```bash
# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Delete .next cache
rm -rf .next

# Restart
npm run dev
```

### Solution 4: Check next-intl Version

Make sure you have the latest version:

```bash
npm install next-intl@latest
```

## TypeScript Errors with Prisma

If you see errors like "assignedTo does not exist":

```bash
npx prisma generate
```

This regenerates the Prisma client with the new schema.

## Database Migration Errors

If migrations fail:

```bash
# Reset the database (WARNING: deletes all data)
npx prisma migrate reset

# Or create a new migration
npx prisma migrate dev --name your_migration_name
```

## Port 3000 Already in Use

```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

## Build Errors

If build fails:

```bash
# Clear cache
rm -rf .next

# Try building
npm run build

# Check for errors in the output
```

## Still Having Issues?

1. Make sure all dependencies are installed: `npm install`
2. Make sure Prisma client is generated: `npx prisma generate`
3. Make sure database is migrated: `npx prisma migrate dev`
4. Delete `.next` folder and restart
5. Check that your `.env` file has the correct `DATABASE_URL`

## Quick Reset (Nuclear Option)

If nothing works, start fresh:

```bash
# Stop server
# Delete everything
rm -rf node_modules package-lock.json .next

# Reinstall
npm install

# Setup database
npx prisma generate
npx prisma migrate dev --name initial_setup

# Start fresh
npm run dev
```
