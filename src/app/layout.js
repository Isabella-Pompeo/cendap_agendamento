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

import { AuthProvider } from '../contexts/AuthContext';
import { Outfit } from 'next/font/google';
import Script from 'next/script';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={outfit.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-17968336852"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-17968336852');
            `,
          }}
        />
        <Script
          id="fb-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '922376520709590'}');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '922376520709590'}&ev=PageView&noscript=1`}
          />
        </noscript>
      </body>
      <GoogleAnalytics gaId="G-2NG6ZZCKNN" />
    </html>
  );
}
