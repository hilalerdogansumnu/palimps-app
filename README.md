# PALIMPS

**Personal Reading Memory System**

A mobile app for capturing, organizing, and remembering your reading moments from physical books.

[![App Store](https://img.shields.io/badge/App%20Store-Coming%20Soon-blue)](https://palimps.app)
[![Platform](https://img.shields.io/badge/platform-iOS-lightgrey)](https://developer.apple.com)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

---

## 📖 About

PALIMPS is your personal reading memory system for physical books. Capture pages from your favorite books, extract text with powerful OCR technology, and create meaningful reading moments with AI-powered notes.

**Website:** [palimps.app](https://palimps.app)

---

## ✨ Features

### 📚 Book Library
- Organize your physical book collection
- Add books with cover photos
- Track reading progress and moments
- Search across all your books

### 📸 Smart Page Capture
- Take photos of book pages
- Automatic text extraction with OCR
- High-quality image storage
- Chronological timeline of reading moments

### ✍️ Reading Moments
- Create notes for each page you read
- AI-powered note generation (Premium)
- Edit and organize your thoughts
- Export moments as PDF or Markdown

### 🔍 Powerful Search
- Search across book titles and authors
- Find text within captured pages
- Sort by relevance, date, or author
- Quick access to your reading history

### 🌍 Multilingual Support
- Available in English, Turkish, German, and Spanish
- Switch languages anytime from settings
- Localized user interface

### 🎨 Beautiful Design
- Minimal, Apple Notes-level interface
- Clean typography and generous whitespace
- Dark mode support
- Designed for one-handed use

---

## 🚀 Tech Stack

### Mobile App
- **Framework:** React Native 0.81 with Expo SDK 54
- **Language:** TypeScript 5.9
- **UI:** NativeWind 4 (Tailwind CSS for React Native)
- **Navigation:** Expo Router 6
- **Animations:** react-native-reanimated 4.x
- **State Management:** React Context + TanStack Query

### Backend
- **Runtime:** Node.js with Express
- **API:** tRPC for type-safe API calls
- **Database:** PostgreSQL with Drizzle ORM
- **Storage:** S3-compatible object storage
- **Authentication:** OAuth (Google, Apple)
- **AI/LLM:** Built-in multimodal AI for OCR and note generation

### Development
- **Build System:** EAS Build (Expo Application Services)
- **Package Manager:** pnpm
- **Linting:** ESLint with Expo config
- **Type Checking:** TypeScript strict mode

---

## 📦 Project Structure

```
palimps-app/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab-based navigation
│   │   ├── index.tsx      # Home screen (book library)
│   │   ├── search.tsx     # Search screen
│   │   ├── chat.tsx       # AI chatbot screen
│   │   └── profile.tsx    # Profile and settings
│   ├── oauth/             # OAuth callback handlers
│   └── _layout.tsx        # Root layout with providers
├── components/            # Reusable UI components
│   ├── screen-container.tsx
│   ├── themed-view.tsx
│   └── ui/                # UI primitives
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and core logic
│   ├── trpc.ts           # API client
│   ├── utils.ts          # Helper functions
│   └── theme-provider.tsx
├── server/               # Backend server
│   ├── _core/           # Core server logic
│   ├── api/             # API routes (tRPC)
│   └── db/              # Database schema and migrations
├── assets/              # Static assets (images, fonts)
├── app.config.ts        # Expo app configuration
├── eas.json             # EAS Build configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── theme.config.js      # Theme tokens (colors, spacing)
```

---

## 🛠️ Development

### Prerequisites
- Node.js 22.x
- pnpm 9.x
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/hilalerdogansumnu/palimps-app.git
cd palimps-app

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Running the App

```bash
# Start Metro bundler
pnpm dev:metro

# Run on iOS Simulator (Mac only)
pnpm ios

# Run on Android Emulator
pnpm android

# Open in Expo Go (scan QR code)
pnpm qr
```

### Building for Production

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Build and auto-submit to stores
eas build --platform ios --auto-submit --profile production
```

---

## 🗄️ Database

The app uses PostgreSQL with Drizzle ORM. Schema includes:

- **users** - User accounts (OAuth)
- **books** - Book library
- **reading_moments** - Captured pages with OCR text
- **subscriptions** - Premium subscription status

### Migrations

```bash
# Generate migration
pnpm db:push

# Run migrations
drizzle-kit migrate
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/palimps

# S3 Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=palimps-storage
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret

# AI/LLM (built-in, no API key needed)
# OCR and note generation use server's built-in LLM
```

---

## 📱 App Store Deployment

### Requirements
- Apple Developer Account ($99/year)
- Expo Account (free)
- EAS CLI installed

### Steps

1. **Configure EAS Build**
   ```bash
   eas build:configure
   ```

2. **Update App Store Metadata**
   - Edit `APP_STORE_METADATA.md`
   - Prepare screenshots (see `app-store-screenshots/`)

3. **Build and Submit**
   ```bash
   eas build --platform ios --auto-submit --profile production
   ```

4. **Complete Metadata in App Store Connect**
   - Upload screenshots
   - Add description and keywords
   - Set pricing (Free)
   - Submit for review

See `IOS_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## 🎨 Design System

PALIMPS follows a minimal, Apple Notes-inspired design language:

### Colors
- **Background:** Near-white (#F8F8F7) / Near-black (#1C1C1E)
- **Foreground:** Near-black (#11181C) / Near-white (#ECEDEE)
- **Primary:** Muted teal (#0a7ea4)
- **Muted:** Gray (#687076 / #9BA1A6)

### Typography
- **Headings:** SF Pro Display (iOS), System default (Android)
- **Body:** SF Pro Text (iOS), System default (Android)
- **Sizes:** 2xl (32px), xl (24px), lg (18px), base (16px), sm (14px)

### Spacing
- Generous whitespace (16-24px padding)
- Minimal borders (0.5px, subtle)
- Clean layouts with clear hierarchy

---

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Type checking
pnpm check

# Linting
pnpm lint
```

---

## 📄 License

© 2026 PALIMPS. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 🤝 Contributing

This is a private project. Contributions are not accepted at this time.

---

## 📞 Contact

- **Website:** [palimps.app](https://palimps.app)
- **Support:** support@palimps.app
- **Privacy Policy:** [palimps.app/gizlilik.html](https://palimps.app/gizlilik.html)

---

## 🙏 Acknowledgments

Built with:
- [Expo](https://expo.dev)
- [React Native](https://reactnative.dev)
- [NativeWind](https://nativewind.dev)
- [tRPC](https://trpc.io)
- [Drizzle ORM](https://orm.drizzle.team)

---

**Made with ❤️ for book lovers**
