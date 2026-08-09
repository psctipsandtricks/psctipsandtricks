# PSC Tips & Tricks — Ed-Tech Platform Monorepo

Welcome to the **PSC Tips & Tricks** monorepo—a modern ed-tech platform built for competitive exam preparation (Kerala PSC / SSC / UPSC). The platform provides interactive quizzes, mock test rank tracking, e-books, study dashboards, quiz battles, real-time community chat, and an admin management control panel.

---

## 🏗️ Architecture & Tech Stack

### Monorepo Tooling
- **Turborepo** with `npm` Workspaces

### Applications (`apps/`)
1. **`apps/api` (Backend API)**
   - **Framework**: NestJS (TypeScript)
   - **Database**: PostgreSQL 16 via Prisma ORM
   - **Caching & Queues**: Redis 7 via `@nestjs-modules/ioredis` & BullMQ
   - **Real-Time**: Socket.io WebSocket Gateway for live rank lists, quiz battles, and community chat
   - **Documentation**: Swagger / OpenAPI at `/api/docs`
   - **Auth**: JWT Authentication with Refresh Tokens
   - **Modules**: Auth, Users, Books, Quizzes, Orders, Admin, Chat, Notifications, Coupons

2. **`apps/web` (Learner Web Portal)**
   - **Framework**: Next.js 14+ (App Router, React 18, TypeScript)
   - **Styling**: Tailwind CSS + `@psc/ui` design system
   - **State & Data Fetching**: TanStack React Query v5
   - **Pages**: Home, Book Listing, Book Reader, Quiz Hub, Live Quiz Engine, Study Dashboard, Razorpay Checkout, Login/Signup.

   - **Admin Panel**: Consolidated into `apps/web` under the `/admin` route (auth-gated) — Content Management (Books, Quizzes, Questions), User Management, Orders & Subscriptions, Coupon Management, Push Notification Composer, Announcement Popups, Recharts analytics.

3. **`mobile/` (Flutter App)**
   - **Framework**: Flutter (Dart) with Clean Architecture layout
   - **Theme**: Deep Navy (`#0F172A`) & Muted Gold (`#D4AF37`)
   - **API Connection**: Configurable HTTP/WebSocket API client connecting to NestJS

---

### Shared Packages (`packages/`)
- **`packages/shared-types`**: Shared TypeScript interfaces, DTOs, and WebSocket event definitions.
- **`packages/ui`**: React component library built with Tailwind CSS (Button, Card, Input, Table, Dialog, Badge, Tabs, Navbar, Sidebar, etc.).
- **`packages/config`**: Reusable tsconfig, ESLint, and Prettier configurations.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js `>= 18.0.0`
- A Supabase project (Postgres database + storage) — no local database or Docker required
- Flutter SDK (for mobile app development)

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` in `apps/api` and `apps/web`, and fill in your Supabase project's connection string / keys:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 3. Database Setup & Seeding
```bash
npm run db:migrate
npm run db:seed
```

### 4. Run Local Development Server
```bash
npm run dev
```

The apps will be available at:
- 🌐 **Web App**: http://localhost:3000
- 🛠️ **Admin Panel**: http://localhost:3000/admin
- ⚡ **NestJS API**: http://localhost:4000
- 📚 **Swagger Docs**: http://localhost:4000/api/docs

### Notes on infrastructure
- **Database**: PostgreSQL runs on Supabase — nothing to run locally.
- **Background jobs** (quiz rank calculation, mock-test rank calculation, push notification dispatch): backed by the [`pgmq`](https://github.com/tembo-io/pgmq) extension on the same Supabase Postgres database, not Redis. The API auto-enables the extension and creates its queues on startup — no manual setup.

---

## 📱 Mobile Setup (Flutter)
Navigate to the `mobile/` directory:
```bash
cd mobile
flutter pub get
flutter run
```

---

## 📜 Scripts Reference
- `npm run dev`: Runs all apps (`api`, `web`) in parallel via Turborepo.
- `npm run build`: Builds all packages and apps.
- `npm run db:generate`: Generates Prisma Client.
- `npm run db:migrate`: Runs Prisma database migrations.
- `npm run db:seed`: Seeds sample books, quizzes, and test admin user into Postgres.
