import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Kos Management",
    template: "%s · Kos Management"
  },
  description: "Sistem manajemen kos multi-pemilik: properti, kamar, penyewa, kontrak, tagihan, dan agen sewa."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
