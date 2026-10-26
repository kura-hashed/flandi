import type { Metadata } from "next";
import { Coiny, Quicksand } from "next/font/google";
import "./globals.css";
import { CustomerAuthProvider } from "@/lib/customer-auth-context";

const coiny = Coiny({
  weight: "400",
  subsets: ["latin", "vietnamese"],
  variable: "--font-fredoka",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tiệm bánh Flandi",
  description:
    "Bánh Flan, Panna Cotta trái cây tươi, Rau câu dừa nhân Flan, Rau câu lá dứa cà phê, Tàu hũ Singapore & Sữa chua nhà làm tươi mới mỗi ngày.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${coiny.variable} ${quicksand.variable}`}
      suppressHydrationWarning
    >
      <body
        className="antialiased selection:bg-flandi-pink selection:text-flandi-dark"
        suppressHydrationWarning
      >
        <CustomerAuthProvider>{children}</CustomerAuthProvider>
      </body>
    </html>
  );
}
