# Deployment Guide - Vercel + Neon (PostgreSQL)

This guide will help you deploy your Pump Intervention Manager to Vercel with a free Neon PostgreSQL database.

## Prerequisites

- GitHub account
- Vercel account (sign up at vercel.com - it's free)
- Neon account (sign up at neon.tech - it's free)

## Step 1: Setup Neon Database (Free PostgreSQL)

1. **Go to https://neon.tech and sign up/login**

2. **Create a new project:**
   - Click "Create Project"
   - Choose a name (e.g., "pump-intervention-db")
   - Select region closest to your users
   - Click "Create Project"

3. **Get your connection string:**
   - After creation, you'll see a connection string like:
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
   - **IMPORTANT:** Copy this entire string - you'll need it!

4. **Note:** Free tier includes:
   - 0.5 GB storage
   - Unlimited queries
   - Auto-pause after inactivity (saves resources)

## Step 2: Push Code to GitHub

1. **Initialize git in your project:**
```bash
cd pump-intervention-manager
git init
git add .
git commit -m "Initial commit"
```

2. **Create a new repository on GitHub:**
   - Go to github.com
   - Click "New repository"
   - Name it "pump-intervention-manager"
   - Don't initialize with README
   - Click "Create repository"

3. **Push your code:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/pump-intervention-manager.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. **Go to https://vercel.com and sign in**

2. **Import your project:**
   - Click "Add New" → "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Environment Variables:**
   Click "Environment Variables" and add these:

   ```
   DATABASE_URL = your-neon-connection-string-from-step-1
   
   NEXTAUTH_URL = https://your-app-name.vercel.app
   
   NEXTAUTH_SECRET = [Generate with: openssl rand -base64 32]
   
   JWT_SECRET = [Generate with: openssl rand -base64 32]
   ```

   **To generate secrets on Windows:**
   - Use an online generator: https://generate-secret.vercel.app
   - Or use PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`

4. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete

## Step 4: Run Database Migration

After the first deployment, you need to set up the database:

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Link your project:**
```bash
vercel link
```

4. **Run migration:**
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

Alternatively, you can run migrations from your local machine by updating your `.env` with the Neon connection string and running:
```bash
npx prisma migrate deploy
```

## Step 5: Create First Admin User

1. **Visit your deployed app:**
   - Go to `https://your-app-name.vercel.app`
   - You'll see the "Create Admin Account" form
   - Register the first user (becomes admin automatically)

2. **Done!** You can now:
   - Login with your admin account
   - Create additional users (technicians, supervisors)
   - Start managing interventions

## Alternative: Using Supabase Instead of Neon

If you prefer Supabase:

1. **Sign up at https://supabase.com**

2. **Create a new project:**
   - Give it a name
   - Set a database password (save it!)
   - Choose region

3. **Get connection string:**
   - Go to Project Settings → Database
   - Copy the "Connection string" under "Connection pooling"
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`

4. **Use this as your DATABASE_URL in Vercel**

Both Neon and Supabase have excellent free tiers perfect for this application!

## Continuous Deployment

Once set up, every push to your `main` branch will automatically deploy to Vercel!

```bash
git add .
git commit -m "Your changes"
git push
```

## Free Tier Limits

**Vercel Free:**
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic HTTPS
- Perfect for small teams

**Neon Free:**
- 0.5 GB storage
- Unlimited compute hours
- Auto-pause when idle
- Great for small-medium apps

**Supabase Free:**
- 500 MB storage
- 50,000 monthly active users
- Pauses after 1 week inactivity
- Excellent for startups

## Troubleshooting

**Problem: Build fails**
- Check Vercel build logs
- Make sure all environment variables are set
- Try building locally first: `npm run build`

**Problem: Database connection fails**
- Verify DATABASE_URL is correct
- Make sure it includes `?sslmode=require` for Neon
- Check if database is active (Neon auto-pauses after inactivity)

**Problem: Can't create users**
- Make sure migrations ran successfully
- Check Vercel function logs
- Verify JWT_SECRET and NEXTAUTH_SECRET are set

## Monitoring

- **Vercel Dashboard:** View deployments, logs, analytics
- **Neon Console:** Monitor database usage, queries
- **Vercel Analytics:** Track page views (optional paid add-on)

## Cost Considerations

Everything is FREE up to these limits:
- Vercel: 100GB/month bandwidth
- Neon: 0.5GB storage
- Perfect for teams up to ~50 users with moderate usage

If you need more, paid plans start at:
- Vercel Pro: $20/month
- Neon Scale: $19/month
- Supabase Pro: $25/month

## Support

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Next.js Docs: https://nextjs.org/docs
