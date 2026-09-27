import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"] });
const displayFont = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15171A",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://trioz.ru"),
  title: { default: "TRIOZ — цифровые системы и IT-услуги для бизнеса", template: "%s | TRIOZ" },
  description: "TRIOZ проектирует и внедряет цифровые системы: интеграции, автоматизацию, веб-разработку, инфраструктуру и сопровождение для бизнеса.",
  keywords: ["TRIOZ", "цифровые системы", "IT услуги", "автоматизация бизнеса", "интеграции", "веб-разработка", "инфраструктура"],
  applicationName: "TRIOZ Digital systems",
  generator: "Next.js",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://trioz.ru/",
    siteName: "TRIOZ Digital systems",
    title: "TRIOZ — цифровые системы и IT-услуги для бизнеса",
    description: "Проектируем и внедряем цифровые решения с понятным результатом и ответственностью за запуск.",
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
      "@id": "https://trioz.ru/#organization",
      name: "TRIOZ",
      url: "https://trioz.ru/",
      email: "info@trioz.ru",
      logo: "https://trioz.ru/favicon.svg",
    },
    {
      "@type": "WebSite",
      "@id": "https://trioz.ru/#website",
      url: "https://trioz.ru/",
      name: "TRIOZ Digital systems",
      publisher: { "@id": "https://trioz.ru/#organization" },
      inLanguage: "ru-RU",
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}
