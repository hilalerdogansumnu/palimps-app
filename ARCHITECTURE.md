# PALIMPS Architecture Documentation

> **PALIMPS** - Personal Reading Memory System for Physical Books

Last Updated: February 1, 2026

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Structure](#api-structure)
6. [Authentication Flow](#authentication-flow)
7. [OCR & AI Flow](#ocr--ai-flow)
8. [File Storage](#file-storage)
9. [Deployment](#deployment)
10. [Development Setup](#development-setup)

---

## 🎯 Overview

PALIMPS is a mobile-first application that helps users build a personal reading memory system for physical books. Users can:

- 📚 Organize their physical book collection
- 📸 Capture pages from books with camera
- 🔍 Extract text from pages using OCR
- ✍️ Create and manage reading moments with AI-powered notes
- 🔎 Search across books, pages, and notes
- 🌍 Use the app in multiple languages (English, Turkish, German, Spanish)

---

## 🛠️ Tech Stack

### Frontend (Mobile App)

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | React Native | 0.81 |
| **Runtime** | Expo | SDK 54 |
| **Language** | TypeScript | 5.9 |
| **Routing** | Expo Router | 6 |
| **Styling** | NativeWind (Tailwind CSS) | 4 |
| **State Management** | React Context + AsyncStorage | - |
| **API Client** | tRPC Client | 11.7.2 |
| **Animations** | react-native-reanimated | 4.x |
| **Camera** | expo-camera | - |
| **Image Picker** | expo-image-picker | - |

### Backend (Server)

| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 22.x |
| **Framework** | Express | 4.x |
| **Language** | TypeScript | 5.9 |
| **API** | tRPC | 11.7.2 |
| **ORM** | Drizzle ORM | 0.44.7 |
| **Database** | MySQL | 8.x |
| **Authentication** | OAuth 2.0 + JWT | - |
| **File Storage** | S3-compatible | - |
| **AI/LLM** | Manus AI | - |

### Infrastructure

| Component | Provider |
|-----------|----------|
| **Database** | Manus Cloud (MySQL) |
| **File Storage** | Manus Cloud (S3-compatible) |
| **AI/LLM** | Manus AI Service |
| **Backend Hosting** | Manus Cloud (Node.js) |
| **Mobile Distribution** | App Store (iOS), Google Play (Android) |

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    📱 MOBILE APP                        │
│  (React Native + Expo + NativeWind + tRPC Client)      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Login   │  │ Library  │  │  Camera  │            │
│  │  Screen  │  │  Screen  │  │   OCR    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
│  ┌─────────────────────────────────────────────┐      │
│  │     AsyncStorage (Offline Cache)            │      │
│  └─────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS (tRPC)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  🖥️ BACKEND SERVER                      │
│         (Express + tRPC + Drizzle ORM)                  │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  tRPC Router (Type-safe API)                 │     │
│  │  ├── auth.* (OAuth, login, logout)           │     │
│  │  ├── books.* (CRUD operations)               │     │
│  │  ├── moments.* (CRUD operations)             │     │
│  │  └── ai.* (Note generation)                  │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  Drizzle ORM (Database Layer)                │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ MySQL Protocol
                          ▼
┌─────────────────────────────────────────────────────────┐
│              🗄️ MYSQL DATABASE (Manus Cloud)           │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │  users  │  │  books  │  │ moments │  │  pages  │  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────┘

                          │
                          │ S3 API
                          ▼
┌─────────────────────────────────────────────────────────┐
│           ☁️ S3 STORAGE (Manus Cloud)                   │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  /covers/     (Book covers)                  │     │
│  │  /pages/      (Page photos)                  │     │
│  │  /profiles/   (Profile pictures)             │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘

                          │
                          │ API Call
                          ▼
┌─────────────────────────────────────────────────────────┐
│              🤖 MANUS AI (LLM Service)                  │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │  - OCR (Text extraction from images)         │     │
│  │  - Note Generation (AI-powered notes)        │     │
│  │  - Text Analysis                             │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
okuma-hafizasi-mvp/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx             # Home/Library screen
│   │   ├── search.tsx            # Search screen
│   │   └── profile.tsx           # Profile screen
│   ├── book/[id].tsx             # Book detail screen
│   ├── moment/[id].tsx           # Moment detail screen
│   ├── oauth/callback.tsx        # OAuth callback handler
│   └── _layout.tsx               # Root layout
├── components/                   # Reusable UI components
│   ├── screen-container.tsx      # SafeArea wrapper
│   ├── themed-view.tsx           # Theme-aware view
│   └── ui/                       # UI primitives
├── hooks/                        # Custom React hooks
│   ├── use-auth.ts               # Authentication hook
│   ├── use-colors.ts             # Theme colors hook
│   └── use-color-scheme.ts       # Dark mode detection
├── lib/                          # Utilities and helpers
│   ├── trpc.ts                   # tRPC client setup
│   ├── utils.ts                  # Utility functions
│   └── theme-provider.tsx        # Theme context
├── server/                       # Backend server
│   ├── _core/                    # Core server files
│   │   ├── index.ts              # Express server entry
│   │   ├── trpc.ts               # tRPC router setup
│   │   └── db.ts                 # Database connection
│   ├── routers/                  # tRPC routers
│   │   ├── auth.ts               # Authentication routes
│   │   ├── books.ts              # Books CRUD
│   │   ├── moments.ts            # Moments CRUD
│   │   └── ai.ts                 # AI/OCR routes
│   ├── db/                       # Database schemas
│   │   └── schema.ts             # Drizzle schema
│   └── README.md                 # Backend documentation
├── constants/                    # App constants
│   └── theme.ts                  # Theme configuration
├── assets/                       # Static assets
│   └── images/                   # App icons, splash
├── app.config.ts                 # Expo configuration
├── tailwind.config.js            # Tailwind CSS config
├── theme.config.js               # Theme tokens
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ name            │
│ avatar_url      │
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│     books       │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ title           │
│ author          │
│ cover_url       │
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│    moments      │
├─────────────────┤
│ id (PK)         │
│ book_id (FK)    │
│ user_id (FK)    │
│ page_number     │
│ note            │
│ ai_note         │
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│     pages       │
├─────────────────┤
│ id (PK)         │
│ moment_id (FK)  │
│ image_url       │
│ extracted_text  │
│ created_at      │
└─────────────────┘
```

### Table Definitions

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, AUTO_INCREMENT) | User ID |
| `email` | VARCHAR(255) UNIQUE | User email (from OAuth) |
| `name` | VARCHAR(255) | User full name |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` | TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### `books`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, AUTO_INCREMENT) | Book ID |
| `user_id` | INT (FK → users.id) | Owner user ID |
| `title` | VARCHAR(500) | Book title |
| `author` | VARCHAR(255) | Book author |
| `cover_url` | TEXT | Cover image URL (S3) |
| `created_at` | TIMESTAMP | Book added time |
| `updated_at` | TIMESTAMP | Last update time |

#### `moments`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, AUTO_INCREMENT) | Moment ID |
| `book_id` | INT (FK → books.id) | Associated book |
| `user_id` | INT (FK → users.id) | Owner user ID |
| `page_number` | INT | Page number (optional) |
| `note` | TEXT | User-written note |
| `ai_note` | TEXT | AI-generated note |
| `created_at` | TIMESTAMP | Moment creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### `pages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK, AUTO_INCREMENT) | Page ID |
| `moment_id` | INT (FK → moments.id) | Associated moment |
| `image_url` | TEXT | Page photo URL (S3) |
| `extracted_text` | TEXT | OCR extracted text |
| `created_at` | TIMESTAMP | Page capture time |

---

## 🔌 API Structure

### tRPC Router

PALIMPS uses **tRPC** for type-safe API communication between frontend and backend.

#### Authentication Router (`auth`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `auth.login` | mutation | Initiate OAuth login |
| `auth.callback` | mutation | Handle OAuth callback |
| `auth.logout` | mutation | Logout user |
| `auth.me` | query | Get current user |

#### Books Router (`books`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `books.list` | query | Get user's books |
| `books.get` | query | Get book by ID |
| `books.create` | mutation | Create new book |
| `books.update` | mutation | Update book |
| `books.delete` | mutation | Delete book |
| `books.search` | query | Search books by title/author |

#### Moments Router (`moments`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `moments.list` | query | Get moments for a book |
| `moments.get` | query | Get moment by ID |
| `moments.create` | mutation | Create new moment |
| `moments.update` | mutation | Update moment |
| `moments.delete` | mutation | Delete moment |
| `moments.generateNote` | mutation | Generate AI note |

#### AI Router (`ai`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `ai.extractText` | mutation | OCR text extraction |
| `ai.generateNote` | mutation | Generate AI note from text |

---

## 🔐 Authentication Flow

PALIMPS uses **OAuth 2.0** (Google) for authentication with **JWT** tokens for session management.

### Login Flow

```
1. User taps "Sign in with Google"
   │
   ▼
2. Frontend: Call auth.login (tRPC)
   │
   ▼
3. Backend: Generate OAuth URL
   │
   ▼
4. Frontend: Open OAuth URL in browser
   │
   ▼
5. User: Authorize on Google
   │
   ▼
6. Google: Redirect to callback URL
   │
   ▼
7. Backend: Handle callback (auth.callback)
   │
   ├─ Exchange code for tokens
   ├─ Get user info from Google
   ├─ Create/update user in database
   └─ Generate JWT token
   │
   ▼
8. Frontend: Store JWT in SecureStore
   │
   ▼
9. Frontend: Navigate to home screen
```

### Authenticated Requests

```
1. Frontend: Make tRPC request
   │
   ├─ Add JWT token to headers
   │  Authorization: Bearer <token>
   │
   ▼
2. Backend: Verify JWT token
   │
   ├─ Valid? → Continue
   └─ Invalid? → Return 401 Unauthorized
   │
   ▼
3. Backend: Execute request
   │
   ▼
4. Frontend: Receive response
```

---

## 📸 OCR & AI Flow

### Page Capture and OCR

```
1. User opens camera in app
   │
   ▼
2. User takes photo of book page
   │
   ▼
3. Frontend: Upload photo to S3
   │
   ├─ Generate unique filename
   ├─ Upload to /pages/{user_id}/{filename}
   └─ Get public URL
   │
   ▼
4. Frontend: Call moments.create (tRPC)
   │
   ├─ book_id
   ├─ page_number (optional)
   └─ image_url (S3 URL)
   │
   ▼
5. Backend: Call Manus AI for OCR
   │
   ├─ Send image_url
   └─ Receive extracted_text
   │
   ▼
6. Backend: Save moment + page to database
   │
   ├─ moments table (moment data)
   └─ pages table (image_url, extracted_text)
   │
   ▼
7. Frontend: Display moment with extracted text
```

### AI Note Generation

```
1. User taps "Generate AI Note" on moment
   │
   ▼
2. Frontend: Call moments.generateNote (tRPC)
   │
   └─ moment_id
   │
   ▼
3. Backend: Get moment and extracted text
   │
   ▼
4. Backend: Call Manus AI for note generation
   │
   ├─ Send extracted_text
   ├─ Send context (book title, author)
   └─ Receive ai_note
   │
   ▼
5. Backend: Update moment with ai_note
   │
   ▼
6. Frontend: Display AI-generated note
```

---

## 📦 File Storage

### S3-compatible Storage Structure

```
s3://palimps-storage/
├── covers/
│   ├── {user_id}/
│   │   ├── {book_id}_cover.jpg
│   │   └── ...
├── pages/
│   ├── {user_id}/
│   │   ├── {moment_id}_page_1.jpg
│   │   ├── {moment_id}_page_2.jpg
│   │   └── ...
└── profiles/
    ├── {user_id}_avatar.jpg
    └── ...
```

### File Upload Flow

```
1. Frontend: Select/capture image
   │
   ▼
2. Frontend: Prepare file
   │
   ├─ Compress image (if needed)
   ├─ Generate unique filename
   └─ Determine S3 path
   │
   ▼
3. Frontend: Upload to S3
   │
   ├─ Use presigned URL (from backend)
   └─ Or direct upload with credentials
   │
   ▼
4. Frontend: Get public URL
   │
   ▼
5. Frontend: Send URL to backend (via tRPC)
   │
   ▼
6. Backend: Save URL to database
```

---

## 🚀 Deployment

### Backend Deployment

**Platform:** Manus Cloud (Node.js runtime)

```bash
# Build backend
npm run build

# Start production server
npm run start
```

**Environment Variables:**
- `DATABASE_URL`: MySQL connection string
- `S3_ENDPOINT`: S3 storage endpoint
- `S3_ACCESS_KEY`: S3 access key
- `S3_SECRET_KEY`: S3 secret key
- `JWT_SECRET`: JWT signing secret
- `OAUTH_CLIENT_ID`: Google OAuth client ID
- `OAUTH_CLIENT_SECRET`: Google OAuth client secret

### Mobile App Deployment

**Platform:** Expo Application Services (EAS)

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

**Configuration:** `app.config.ts`

---

## 💻 Development Setup

### Prerequisites

- Node.js 22.x
- pnpm 9.x
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/okuma-hafizasi-mvp.git
cd okuma-hafizasi-mvp

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

This will start:
- Backend server on `http://localhost:3000`
- Expo Metro bundler on `http://localhost:8081`

### Running on Device

```bash
# iOS (requires Mac)
pnpm ios

# Android
pnpm android

# Expo Go (scan QR code)
pnpm qr
```

---

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [tRPC Documentation](https://trpc.io/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [NativeWind Documentation](https://www.nativewind.dev/)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👥 Contributors

- **Hilal Erdoğan Sümnu** - Project Owner & Developer

---

**Last Updated:** February 1, 2026
