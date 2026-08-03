import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "MedkwikHealthbuddy",
    template: "%s | MedkwikHealthbuddy",
  },
  description:
    "Your smart health companion — manage appointments, records, and wellness in one place.",
  keywords: ["health", "medical", "appointments", "wellness", "hospital"],
  authors: [{ name: "MedkwikHealthbuddy" }],
  robots: "index, follow",
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
              .then(function(reg) {
                reg.update();
              })
              .catch(function() {});
          }
        `}</Script>
      </body>
    </html>
  );
}
