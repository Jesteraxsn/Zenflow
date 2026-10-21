import { Cormorant_Garamond, Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { BookingProvider } from "@/context/BookingContext";
import SplashScreen from "@/components/SplashScreen";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Ginhawa — Spa & Wellness Sanctuary",
    template: "%s · Ginhawa",
  },
  applicationName: "Ginhawa (powered by ZenFlow)",
  description: "Reserve restorative treatments at Ginhawa. Powered by ZenFlow.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <SplashScreen />
        <AuthProvider>
          <BookingProvider>{children}</BookingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
