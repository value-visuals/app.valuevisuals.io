// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { CurrencyProvider } from "@/components/Currency";
import AppNavigation from "@/components/AppNavigation";

export const metadata: Metadata = {
  title: "Value Visuals | Market Intelligence",
  description: "Explore Bitcoin, Ethereum, Monero, Gold and Silver. Public market data with a private financial workspace.",
  manifest: "/manifest.webmanifest",
  applicationName: "Value Visuals",
  appleWebApp: { capable: true, title: "Value Visuals", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }], apple: "/icon-192.png" },
};

// ✅ Add this:
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // accounts for iOS safe areas
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider>
          <AuthProvider><CurrencyProvider><AppNavigation />{children}</CurrencyProvider></AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
