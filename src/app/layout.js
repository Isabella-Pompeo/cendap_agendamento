import "./globals.css";

export const metadata = {
  title: "Agendamento Virtual",
  description: "Agende sua consulta com especialistas.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
