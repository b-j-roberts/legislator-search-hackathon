import type { Metadata } from "next";
import { Source_Sans_3, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { ThemeProvider, ChatProvider, ContactProvider } from "@/components/providers";
import { Header } from "@/components/layout";
import { ConversationSidebar } from "@/components/conversation/conversation-sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
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
        className={`${sourceSans.variable} ${playfair.variable} ${jetbrainsMono.variable} antialiased h-dvh flex overflow-hidden`}
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
