import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";

export const metadata = {
  title: "Agendamento Virtual",
  description: "Agende sua consulta online em Capitão Poço no Cendap. Clínica particular com diversas especialidades médicas. Atendimento rápido, sem filas e sem ligar.",
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
