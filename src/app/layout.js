import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";

export const metadata = {
  title: "CENDAP - Agendamento Online | Capitão Poço",
  description: "Agende sua consulta online em Capitão Poço no Cendap. Clínica particular com diversas especialidades médicas. Atendimento rápido, sem filas e sem ligar.",
  keywords: ["agendamento online", "consulta médica", "Capitão Poço", "Cendap", "clínica", "saúde", "exames", "médicos"],
  authors: [{ name: "Cendap" }],
  openGraph: {
    title: "CENDAP - Agendamento Online | Capitão Poço",
    description: "Agende sua consulta online com rapidez e facilidade no Cendap.",
    url: "https://www.agendacendap.com.br",
    siteName: "Cendap Agendamento",
    locale: "pt_BR",
    type: "website",
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  verification: {
    google: "Tj5xen3vKPXD77luznWpMeKvSjKJDCz-UHWWXuvKdIk",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { Outfit } from 'next/font/google';
import Script from 'next/script';
const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={outfit.className}>
        {children}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-16567834416"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-16567834416');
            `,
          }}
        />
      </body>
      <GoogleAnalytics gaId="G-2NG6ZZCKNN" />
    </html>
  );
}
