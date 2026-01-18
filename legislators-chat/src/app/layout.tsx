import type { Metadata } from "next";
import { DM_Sans, Libre_Baskerville, Geist_Mono } from "next/font/google";
import { ThemeProvider, ChatProvider, ContactProvider } from "@/components/providers";
import { Header } from "@/components/layout";
import { ConversationSidebar } from "@/components/conversation/conversation-sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legislators Chat",
  description:
    "AI-powered chat interface for researching US legislators, congressional hearings, and voting records.",
  keywords: ["congress", "legislators", "voting records", "congressional hearings", "civic tech"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${libreBaskerville.variable} ${geistMono.variable} antialiased h-dvh flex overflow-hidden`}
      >
        <ThemeProvider>
          <ChatProvider>
            <ContactProvider>
              <ConversationSidebar />
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                <Header />
                {children}
              </div>
              <Toaster position="top-right" richColors closeButton />
            </ContactProvider>
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
