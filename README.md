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

## 🔑 Google Sign-In on mobile

The app uses the **native** Google account picker, not a WebView: tapping *Google* asks Android
for an ID token for one of the accounts already on the phone, and posts it to
`POST /auth/google/native`. The API verifies the token with Google's `tokeninfo` endpoint,
checks that its `aud` is one of this deployment's client IDs, and issues the usual session.

The browser handshake (`GET /auth/google`) is still there and still used by the website — and the
app falls back to it automatically if the native flow cannot run, so a device without Play
Services or a build whose signing certificate is not registered still signs in.

**The one thing that must be kept in sync:** the OAuth *Android* client in Google Cloud is tied to
the app's package name **and signing certificate fingerprint**. Every signing key that ships the
app needs its SHA-1 registered — the debug key for local builds, the upload key for release, and
the one Google Play generates if Play App Signing is on.

Without it the account picker still appears (it is drawn by the platform before the client is
checked), but picking an account fails with `UNREGISTERED_ON_API_CONSOLE` in logcat under the
`Auth.Api.Credentials` tag, and the app falls back to the browser flow. Play Services reports that
failure as a *cancellation*, same as a dismissed picker — `GoogleNativeSignIn` tells them apart by
the message ("Cancelled by user" vs anything else) so a misconfigured build degrades to the
WebView instead of silently doing nothing.

Package name: `com.psctipsandtricks.student`. Debug keystore SHA-1 on this machine:
`F4:1E:81:6A:F3:36:E0:F7:72:05:95:81:A9:39:2D:DC:4F:27:44:63` (re-check yours with
`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`).

Add fingerprints under Firebase console → Project settings → *Your apps* → Android → *Add
fingerprint*, or in Google Cloud Console → Credentials. The ID token is requested for the **web**
client (`GOOGLE_CLIENT_ID`), which is what the API verifies; `GOOGLE_ANDROID_CLIENT_ID` /
`GOOGLE_IOS_CLIENT_ID` only need setting for a build configured to request its own client's token.

---

## 🔔 Push Notifications (Firebase Cloud Messaging)

Notifications sent from **Admin → Notifications** are saved to the database, queued on `pgmq`,
and delivered to devices by the API's `NotificationProcessor`. Delivery is off until Firebase
credentials are present — until then the notification is still saved and shows up in the app's
notifications screen, it just does not arrive on its own. Nothing crashes and no build breaks
in the meantime.

**Targeting.** A notification with no `userId` is a broadcast: the API publishes it once to the
`all-students` FCM topic, which every installation subscribes to on launch. A notification aimed
at one student is sent per registered device, and tokens FCM reports as dead are deleted.

### 1. Create the Firebase project
Firebase console → add a project → add an **Android app** with package name
`com.psctipsandtricks.student`.

### 2. Configure the Flutter app
```bash
cd mobile
dart pub global activate flutterfire_cli
flutterfire configure
```
This overwrites `mobile/lib/firebase_options.dart`, which currently holds placeholders. The app
detects the placeholders and keeps push switched off, so this step is what turns the feature on.

### 3. Configure the API
Firebase console → Project settings → **Service accounts** → *Generate new private key*. From
the downloaded JSON, set in `apps/api/.env` (and in Railway's variables):

```bash
FIREBASE_PROJECT_ID="..."          # project_id
FIREBASE_CLIENT_EMAIL="..."        # client_email
FIREBASE_PRIVATE_KEY="..."         # private_key, one line, keeping the \n escapes
```

### 4. Apply the schema change
Push notifications add a `DeviceToken` table:
```bash
cd apps/api && npx prisma db push
```

### 5. Check it end to end
Send a notification from the admin panel and watch the API log for
`Broadcast notification <id> to topic all-students`. On the device, notifications arriving while
the app is open are drawn on the `psc_default` channel; tapping any of them opens the
notifications screen, or the `route` named in the message's data payload.

---

## 📜 Scripts Reference
- `npm run dev`: Runs all apps (`api`, `web`) in parallel via Turborepo.
- `npm run build`: Builds all packages and apps.
- `npm run db:generate`: Generates Prisma Client.
- `npm run db:migrate`: Runs Prisma database migrations.
- `npm run db:seed`: Seeds sample books, quizzes, and test admin user into Postgres.
