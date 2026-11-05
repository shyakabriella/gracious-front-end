import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Gracious Investment Ltd | Real Estate in Rwanda",
    template: "%s | Gracious Investment Ltd",
  },
  description:
    "Explore houses, apartments, land and investment properties " +
    "in Rwanda with Gracious Investment Ltd. Property sales, " +
    "rentals, management and real estate consultation.",
  applicationName: "Gracious Investment Ltd",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${workSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
