import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { PwaRegister } from "@/components/pwa/register";
import { InstallBanner } from "@/components/pwa/install-banner";
import "@clinicflow/ui/tokens.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Clinicflow",
  description: "SaaS de gestión para clínicas en Perú",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clinicflow" },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <PwaRegister />
        <OfflineBanner />
        <InstallBanner />
      </body>
    </html>
  );
}
