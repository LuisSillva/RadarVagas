import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar: vagas de estágio e júnior",
  description:
    "Coleta vagas de estágio, trainee e júnior em big techs, bancos e multinacionais e organiza as candidaturas em um kanban.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
