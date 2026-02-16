import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";

export const metadata = {
  title: "CENDAP Clínica Particular em Capitão-Poço | Agendamento Online",
  description: "Agende sua consulta online em Capitão Poço no Cendap. Clínica particular com diversas especialidades médicas. Atendimento rápido, sem filas e sem ligar.",
  keywords: ["agendamento online", "consulta médica", "Capitão Poço", "Cendap", "clínica", "saúde", "exames", "médicos"],
  authors: [{ name: "Cendap" }],
  openGraph: {
    title: "CENDAP Clínica Particular em Capitão-Poço | Agendamento Online",
    description: "Agende sua consulta online com rapidez e facilidade no Cendap.",
    url: "https://www.agendacendap.com.br",
    siteName: "Cendap Agendamento",
    locale: "pt_BR",
    type: "website",
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

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
      <GoogleAnalytics gaId="G-2NG6ZZCKNN" />
    </html>
  );
}
