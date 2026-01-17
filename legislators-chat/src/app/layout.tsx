import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, ChatProvider } from "@/components/providers";
import { Header } from "@/components/layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legislators Chat",
  description:
    "AI-powered chat interface for researching US legislators, congressional hearings, and voting records.",
  keywords: [
    "congress",
    "legislators",
    "voting records",
    "congressional hearings",
    "civic tech",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-dvh flex flex-col overflow-hidden`}
      >
        <ThemeProvider>
          <ChatProvider>
            <Header />
            {children}
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
