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
  title: "mindy - Your Civic Engagement Assistant",
  description:
    "Meet mindy, your friendly AI assistant for researching US legislators, understanding their positions, and making your voice heard on the issues you care about.",
  keywords: ["congress", "legislators", "voting records", "congressional hearings", "civic engagement", "contact representatives"],
  icons: {
    icon: [
      { url: "/mindy_media_kit/favicons/favicon.ico" },
      { url: "/mindy_media_kit/favicons/mindy_icon_32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/mindy_media_kit/favicons/mindy_icon_16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/mindy_media_kit/favicons/mindy_icon_180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "mindy - Your Civic Engagement Assistant",
    description: "Meet mindy, your friendly AI assistant for researching US legislators and making your voice heard.",
    images: ["/mindy_media_kit/social/og_pink_1200x630.jpg"],
  },
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
