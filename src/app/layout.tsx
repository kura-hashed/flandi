import type { Metadata } from "next";
import { Coiny, Quicksand } from "next/font/google";
import "./globals.css";

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
  title: "FLANDI — Muốn ăn hãy Flăn vào tớ | Tiệm Tráng Miệng Nhà Làm",
  description:
    "Bánh Flan, Panna Cotta trái cây tươi, Rau câu dừa nhân Flan, Rau câu lá dứa cà phê, Tàu hũ Singapore & Sữa chua nhà làm tươi mới mỗi ngày.",
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
        {children}
      </body>
    </html>
  );
}
