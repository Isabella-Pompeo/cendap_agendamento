import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";

export const metadata = {
  title: "Agendamento Virtual",
  description: "Agende sua consulta com especialistas.",
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
