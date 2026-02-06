import "./globals.css";

export const metadata = {
  title: "Agendamento Online",
  description: "Agende sua consulta com especialistas.",
  icons: {
    icon: '/logo-cendap.png',
    apple: '/logo-cendap.png',
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
