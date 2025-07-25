import type { Metadata } from "next";
import ThemeLayout from "./ThemeLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--color-bg-gradient)', color: 'var(--color-text)', minHeight: '100vh', margin: 0 }}>
        <ThemeLayout>{children}</ThemeLayout>
      </body>
    </html>
  );
}
