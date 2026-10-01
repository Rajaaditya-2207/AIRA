import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora, Bricolage_Grotesque, Inter } from "next/font/google";

import { AppNavbar } from "@/components/app/app-navbar";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AIRA",
    template: "%s | AIRA",
  },
  description:
    "AIRA investigates before you decide — AI agents call contacts, gather facts, verify answers, and deliver evidence-backed recommendations.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${bricolage.variable} ${inter.variable}`}
    >
      <body className="antialiased">
        <script
          // Apply saved theme + display font before first paint to avoid flashes.
          // ?theme=light|dark URL param overrides (handy for visual QA).
          // NOTE: font vars live on <html> (not <body>) because the display-font
          // system writes --aira-font-display onto documentElement — CSS custom
          // properties inherit downward only, so body-scoped vars are invisible
          // to html-scoped consumers.
          dangerouslySetInnerHTML={{
            __html: `try{
              const qp=new URLSearchParams(location.search).get("theme");
              const t=qp||localStorage.getItem("aira-theme");
              if(t==="dark"||(!t&&!qp&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}
              if(t==="light"){document.documentElement.classList.remove("dark")}
              const f=localStorage.getItem("aira-font");
              if(f){document.documentElement.style.setProperty("--aira-font-display",f)}
            }catch(e){}`,
          }}
        />
        <div className="min-h-dvh bg-background">
          <AppNavbar />
          {children}
        </div>
      </body>
    </html>
  );
}
