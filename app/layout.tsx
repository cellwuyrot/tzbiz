import { CookieConsent } from "@/components/cookie-consent";
import { safeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import { SITE_URL, siteUrl } from "@/lib/site-url";

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const displayFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15171A",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TRIOZ — цифровые системы и IT-услуги для бизнеса",
    template: "%s | TRIOZ",
  },
  description:
    "TRIOZ проектирует и внедряет цифровые системы: интеграции, автоматизацию, веб-разработку, инфраструктуру и сопровождение для бизнеса.",
  keywords: [
    "TRIOZ",
    "цифровые системы",
    "IT услуги",
    "автоматизация бизнеса",
    "интеграции",
    "веб-разработка",
    "инфраструктура",
  ],
  applicationName: "TRIOZ Digital systems",
  generator: "Next.js",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl("/"),
    siteName: "TRIOZ Digital systems",
    title: "TRIOZ — цифровые системы и IT-услуги для бизнеса",
    description:
      "Проектируем и внедряем цифровые решения с понятным результатом и ответственностью за запуск.",
  },
  twitter: {
    card: "summary",
    title: "TRIOZ — цифровые системы и IT-услуги для бизнеса",
    description: "Проектируем и внедряем цифровые решения для бизнеса.",
  },
  icons: { icon: "/favicon.svg" },
  formatDetection: { email: false, telephone: true, address: false },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl("/#organization"),
      name: "TRIOZ",
      url: siteUrl("/"),
      email: "info@trioz.ru",
      logo: siteUrl("/favicon.svg"),
    },
    {
      "@type": "WebSite",
      "@id": siteUrl("/#website"),
      url: siteUrl("/"),
      name: "TRIOZ Digital systems",
      publisher: { "@id": siteUrl("/#organization") },
      inLanguage: "ru-RU",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
