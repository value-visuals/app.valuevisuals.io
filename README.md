# Value Visuals App

## 📌 Overview

Value Visuals is a web application built with **Next.js** and **TypeScript**.
It provides cryptocurrency market data dashboards, authentication, and theming, with Firebase integration for backend services.

---

## 📂 Project Structure

```
app.valuevisuals.io/
├── public/                         # Static assets (icons, images)
├── src/                            # Main application source
│   ├── app/                        # Next.js App Router pages
│   │   ├── api/                    # API routes
│   │   │   ├── auth/               # Authentication endpoints
│   │   │   │   ├── signup/route.ts
│   │   │   │   └── signin/route.ts
│   │   │   └── crypto/             # Crypto data APIs
│   │   │       ├── chart/route.ts
│   │   │       └── summary/route.ts
│   │   ├── (auth)/                 # Auth-related pages
│   │   │   ├── signin/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/            # Dashboard views
│   │   │   └── dashboard/
│   │   │       ├── bitcoin/page.tsx
│   │   │       ├── ethereum/page.tsx
│   │   │       ├── charts/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── layout.tsx              # Root layout
│   │   ├── globals.css             # Global styles
│   │   └── page.tsx                # Landing page
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # Basic UI elements
│   │   │   └── button.tsx
│   │   ├── auth/                   # Auth helpers (context, guards)
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── LogoutButton.tsx
│   │   │   └── RequireAuth.tsx
│   │   ├── theme/                  # Theme management
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── TopTiles.tsx
│   │   ├── PriceChart.tsx
│   │   ├── BitcoinTopTile.tsx
│   │   ├── EthereumTopTile.tsx
│   │   └── SideBar.tsx
│   │
│   └── lib/                        # Utility modules
│       ├── firebase.ts             # Firebase server-side config
│       ├── firebaseClient.ts       # Firebase client SDK setup
│       ├── authApi.ts              # Authentication API helpers
│       ├── authFetch.ts            # Authenticated fetch wrapper
│       ├── getApiUrl.ts            # API base URL resolver
│       ├── utils.ts                # General utilities
│       └── coinMeta.ts             # Metadata for crypto assets
│
└── 
```

---

## 🚀 Features

* **Authentication**: Signup & Signin pages with Firebase integration.
* **Dashboard**: Interactive cryptocurrency dashboards (Bitcoin, Ethereum, charts, settings).
* **API Endpoints**:

  * `/api/auth/signin` & `/api/auth/signup`
  * `/api/crypto/chart` & `/api/crypto/summary`
* **UI Components**: Reusable tiles, charts, buttons, and sidebar navigation.
* **Theme Support**: Light/Dark theme toggling with context provider.
* **Firebase**: Client/server SDK integration for auth and data handling.

---

## ⚙️ Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* npm (preferred) or yarn
* Firebase project configured

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start dev server
npm run dev
```

### Build & Production

```bash
npm run build
npm start
```

---

## 🔑 Environment Variables

Create a `.env.local` file in the root directory:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## 🛠️ Tech Stack

* **Framework**: Next.js (App Router)
* **Language**: TypeScript
* **Styling**: CSS (global + modular)
* **Auth & DB**: Firebase
* **Charts**: Custom chart components
* **UI**: Reusable component library

---

