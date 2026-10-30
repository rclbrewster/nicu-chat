import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stanford NICU Reference",
  description:
    "A retrieval-augmented reference tool for NICU clinicians, grounded in a curated set of unit documents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
