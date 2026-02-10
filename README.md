# Pump Intervention Manager

A Next.js application for managing pump station interventions with client management and user authentication.

## Features

- 🔐 User authentication (login only - registration via admin panel)
- 👥 **Role-based access control**: Admin, Supervisor, Technician
- 🔧 **Admin Panel**: User management with full CRUD operations
- 📊 Client management with full CRUD operations
- 🔧 Intervention tracking with statuses (Open, In Progress, Quality Assessment, Completed, Canceled)
- 📈 Dashboard with statistics and quick actions
- 🔍 View all interventions for each client
- 🌍 **Multi-language support**: English, Portuguese, Spanish
- 🗄️ PostgreSQL database with Prisma ORM
- ☁️ **Ready for free deployment**: Vercel + Neon/Supabase
- 🎨 Tailwind CSS for styling

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM (compatible with Neon, Supabase)
- **Authentication**: JWT tokens with bcryptjs
- **Styling**: Tailwind CSS
- **Internationalization**: next-intl (English, Portuguese, Spanish)

## Database Schema

### Users
- id, email, password (hashed), name, role (ADMIN, SUPERVISOR, TECHNICIAN), timestamps
- **First user registered becomes ADMIN automatically**
- **Roles**:
  - **ADMIN**: Full system access, can manage users
  - **SUPERVISOR**: Can view and manage all interventions
  - **TECHNICIAN**: Can view and create interventions

### Clients
- id, name, address, city, postalCode, phone, email, contactPerson, notes, timestamps

### Interventions
- id, clientId, employeeId, status, workDone, timeSpent, description, partsUsed, timestamps
- Status: OPEN | IN_PROGRESS | COMPLETED

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup PostgreSQL Database

**Option A - Local Development (PostgreSQL):**

Make sure you have PostgreSQL installed locally:

```bash
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql
```

Create a new database:
```sql
CREATE DATABASE pump_intervention_db;
```

**Option B - Free Cloud Database (Recommended for Production):**

See `DEPLOYMENT.md` for detailed instructions on setting up with:
- **Neon** (recommended): https://neon.tech
- **Supabase**: https://supabase.com

Both offer generous free tiers perfect for this application.

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update the `.env` file with your PostgreSQL credentials:

```env
# Local PostgreSQL
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/pump_intervention_db"

# Or use Neon/Supabase (see DEPLOYMENT.md)
# DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
JWT_SECRET="your-jwt-secret-here"
```

**Important**: Generate secure secrets for production:
```bash
# Generate a random secret
openssl rand -base64 32
```

### 4. Run Prisma Migrations

```bash
npx prisma migrate dev --name init
```

This will create all the necessary tables in your MySQL database.

### 5. (Optional) Seed the Database

You can manually create a user through the register page, or use Prisma Studio:

```bash
npx prisma studio
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### First Time Setup

1. Go to http://localhost:3000
2. **IMPORTANT**: Register your first user - this will become the admin account
3. You'll be automatically logged in
4. Go to **Admin Panel** to create additional users (technicians, supervisors, or more admins)
5. Start adding clients and interventions!

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register first user (becomes admin)

#### Admin (Admin only)
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `GET /api/admin/users/[id]` - Get single user
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user

#### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/[id]` - Get client with interventions
- `PUT /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

#### Interventions
- `GET /api/interventions` - Get all interventions
- `POST /api/interventions` - Create new intervention
- `GET /api/interventions/[id]` - Get single intervention
- `PUT /api/interventions/[id]` - Update intervention
- `DELETE /api/interventions/[id]` - Delete intervention

### Authentication

All API endpoints (except login/register) require a JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

The token is automatically stored in localStorage after login.

## 🚀 Deployment

This app is ready for **free deployment** on Vercel with PostgreSQL from Neon or Supabase.

**See `DEPLOYMENT.md` for complete step-by-step instructions on:**
- Setting up free PostgreSQL database (Neon or Supabase)
- Deploying to Vercel
- Running database migrations
- Environment variable configuration

Free tier is perfect for small-medium teams!

## 🌍 Multi-Language Support

The app supports 3 languages out of the box:
- 🇬🇧 English (default)
- 🇵🇹 Portuguese (Português)
- 🇪🇸 Spanish (Español)

Users can switch languages using the dropdown in the navigation bar. The selected language is automatically applied to all interface text.

**To add more languages:**
1. Create a new JSON file in `/messages/` (e.g., `fr.json` for French)
2. Add the locale to `i18n.ts` locales array
3. Add it to the LanguageSwitcher component

## Project Structure

```
pump-intervention-manager/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── register/route.ts
│   │   ├── clients/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── interventions/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── dashboard/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── auth.ts
│   └── prisma.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
└── README.md
```

## Next Steps

You'll want to create:
1. Dashboard page (`/dashboard`)
2. Clients list and detail pages
3. Interventions list and forms
4. Navigation component
5. Protected route middleware

## Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate

# Create new migration
npx prisma migrate dev --name migration_name
```

## License

MIT
