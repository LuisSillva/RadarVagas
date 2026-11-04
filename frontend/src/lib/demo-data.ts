import type { Category, Job, Level, Region, Status } from "./types";

// Dados de exemplo para o modo demonstração (portfólio sem backend).
// Empresas reais da lista, vagas e notas fictícias.
type Row = [string, Category, string, string, Region, Level, Status, number, number | null, string | null, boolean?];

const ROWS: Row[] = [
  ["Nubank", "fintech", "Software Engineer Intern", "São Paulo, Brazil", "br", "intern", "new", 0.2, 91, "Back-end com Clojure e Python, foco em dados; casa com FastAPI e automações.", true],
  ["Itaú Unibanco", "bank", "Estágio em Engenharia de Software", "São Paulo, SP", "br", "intern", "new", 0.5, 84, "Programa grande, aceita alunos a partir do 1º ano e tem trilha de dados.", true],
  ["iFood", "big_tech", "Estágio em Inteligência Artificial", "Remoto", "br", "intern", "saved", 2, 95, "Vaga de IA aplicada a logística; pede Python e experiência com LLMs.", true],
  ["Mercado Livre", "big_tech", "Desenvolvedor(a) Júnior Back-end", "Osasco, SP", "br", "junior", "new", 1, 72, "Java e Go no dia a dia; Python conta, mas não é a stack principal.", true],
  ["Bradesco", "bank", "Estágio em Tecnologia 2027", "Osasco, SP", "br", "intern", "new", 3, 68, "Programa generalista de TI com rodízio entre áreas.", false],
  ["Santander", "bank", "Programa de Estágio Tech", "São Paulo, SP", "br", "intern", "applied", 9, 77, "Trilha de desenvolvimento e dados, com bolsa e auxílio-home office.", false],
  ["BTG Pactual", "bank", "Estágio em Desenvolvimento .NET", "São Paulo, SP", "br", "intern", "new", 1.5, 58, "Stack principal em C#; vale como experiência em banco de investimento.", false],
  ["XP Inc.", "bank", "Estágio em Engenharia de Dados", "Remoto", "br", "intern", "saved", 4, 88, "Pipeline com Python e SQL; conversa com a matéria de banco de dados.", true],
  ["Stone", "fintech", "Estágio em Desenvolvimento de Software", "Rio de Janeiro, RJ", "br", "intern", "process", 16, 81, "Case técnico em Python marcado para a próxima semana.", false],
  ["PicPay", "fintech", "Pessoa Desenvolvedora Júnior Python", "Remoto", "br", "junior", "applied", 7, 90, "Python e FastAPI citados na descrição.", true],
  ["PagBank", "fintech", "Estágio em Desenvolvimento Mobile", "São Paulo, SP", "br", "intern", "new", 2.5, 54, "Kotlin e Swift; menos aderente ao seu foco em back-end.", false],
  ["Banco Inter", "bank", "Estágio em Desenvolvimento Full Stack", "Belo Horizonte, MG", "br", "intern", "new", 0.8, 74, "React e Node, com remoto parcial.", false],
  ["Sicredi", "bank", "Estágio em TI", "Porto Alegre, RS", "br", "intern", "saved", 5, 70, "Perto de Passo Fundo; programa com efetivação comum.", false],
  ["Ambev", "multinational", "Estágio em Tecnologia e Dados", "São Paulo, SP", "br", "intern", "new", 1.2, 66, "Time de dados de supply; Python e Power BI.", false],
  ["Magazine Luiza", "multinational", "Estágio Luizalabs Desenvolvimento", "Remoto", "br", "intern", "applied", 11, 83, "Luizalabs usa Python em vários serviços.", true],
  ["TOTVS", "multinational", "Desenvolvedor Júnior", "Joinville, SC", "br", "junior", "new", 3.5, 61, "ERP em Progress e Java; aprendizado forte, stack menos comum.", false],
  ["CI&T", "multinational", "Estágio em Desenvolvimento", "Campinas, SP", "br", "intern", "closed", 30, null, null, false],
  ["Natura &Co", "multinational", "Estágio em Tecnologia Digital", "Cajamar, SP", "br", "intern", "new", 6, 57, "E-commerce e dados de cliente.", false],
  ["WEG", "multinational", "Estágio em Desenvolvimento de Sistemas", "Jaraguá do Sul, SC", "br", "intern", "new", 2, 63, "Sistemas industriais, com C# e Python.", false],
  ["Localiza", "multinational", "Trainee de Tecnologia", "Belo Horizonte, MG", "br", "trainee", "saved", 8, 69, "Trainee exige formatura até 2027; confira o requisito.", false],
  ["Globo", "multinational", "Estágio em Engenharia de Software", "Rio de Janeiro, RJ", "br", "intern", "new", 4.5, 76, "Streaming e Globoplay, com Go e Python.", true],
  ["Vivo", "multinational", "Estágio em Dados e IA", "São Paulo, SP", "br", "intern", "new", 0.3, 86, "Projetos de IA generativa no atendimento.", false],
  ["Accenture", "multinational", "Estágio em Desenvolvimento", "Porto Alegre, RS", "br", "intern", "closed", 25, 60, "Recusado na triagem.", false],
  ["Gerdau", "multinational", "Estágio em Automação de Processos", "Porto Alegre, RS", "br", "intern", "new", 5, 64, "RPA e Python; parecido com o que você faz na agência.", false],
  ["Cielo", "fintech", "Estágio em Desenvolvimento Java", "Barueri, SP", "br", "intern", "new", 7, 52, null, false],
  ["Amazon", "big_tech", "Software Development Engineer Intern", "São Paulo, BR", "br", "intern", "saved", 3, 79, "SDE intern no Brasil; processo com teste online de algoritmos.", false],

  ["Pinterest", "big_tech", "Software Engineering Intern, 2027", "Toronto, Canada", "intl", "intern", "saved", 2, 87, "Exige estar matriculado em CS; você atende.", false],
  ["Spotify", "big_tech", "Backend Engineer Intern", "Stockholm, Sweden", "intl", "intern", "new", 1, 85, "Back-end em Java e Python, com visto patrocinado.", false],
  ["Stripe", "big_tech", "Software Engineer, New Grad", "Dublin, Ireland", "intl", "trainee", "new", 4, 62, "New grad pede formatura até 2027; guarde para 2029.", false],
  ["Databricks", "big_tech", "Software Engineering Intern", "Amsterdam, Netherlands", "intl", "intern", "new", 0.6, 80, "Dados e Spark; bom alvo pela sua trilha de dados.", false],
  ["Palantir", "big_tech", "Forward Deployed Engineer Intern", "London, UK", "intl", "intern", "applied", 12, 73, "Muito foco em resolver problema de cliente, parecido com a agência.", false],
  ["OpenAI", "big_tech", "Research Engineer Intern", "San Francisco, US", "intl", "intern", "new", 1.8, 82, "IA aplicada; processo bem competitivo.", false],
  ["NVIDIA", "big_tech", "Software Engineering Intern, AI Infrastructure", "Santa Clara, US", "intl", "intern", "new", 2.2, 71, "Infra de IA com Python e C++.", false],
  ["Duolingo", "big_tech", "Software Engineer Intern", "Pittsburgh, US", "intl", "intern", "new", 3, 78, "Python no back-end e muito A/B test.", false],
  ["Mercado Livre", "big_tech", "Desarrollador Trainee", "Buenos Aires, Argentina", "intl", "trainee", "new", 1.1, 67, "Espanhol necessário.", false],
  ["Datadog", "big_tech", "Software Engineer Intern", "Paris, France", "intl", "intern", "new", 5, 75, "Go e Python; programa de verão de 12 semanas.", false],
  ["Cloudflare", "big_tech", "Software Engineer Intern", "Lisbon, Portugal", "intl", "intern", "saved", 6, 84, "Lisboa facilita a adaptação; Rust e Go.", false],
  ["Roblox", "big_tech", "Software Engineer Intern, Creator", "San Mateo, US", "intl", "intern", "saved", 2.6, 93, "Time de ferramentas para criadores; seus 2 jogos publicados pesam muito.", false],
  ["Bosch", "multinational", "Working Student Software Development", "Stuttgart, Germany", "intl", "intern", "new", 4, 59, "Working student exige matrícula na Alemanha.", false],
  ["Visa", "fintech", "Software Engineer Intern", "Singapore", "intl", "intern", "new", 8, 65, null, false],
  ["Adobe", "big_tech", "Software Development Engineer Intern", "Bucharest, Romania", "intl", "intern", "closed", 20, 70, "Vaga saiu do ar antes da candidatura.", false],
  ["Airbnb", "big_tech", "Software Engineer Intern", "Remote - US", "intl", "intern", "new", 0.4, 77, "Remoto só para quem está nos EUA.", true],
  ["Coinbase", "fintech", "Software Engineer Intern", "Remote - Canada", "intl", "intern", "new", 6.5, 69, null, true],
];

// Prazos de inscrição (em dias a partir de hoje) para vagas que vêm da Gupy.
const DEADLINE_DAYS: Record<string, number> = {
  "Itaú Unibanco": 2,
  "Vivo": 0.4,
  "BTG Pactual": 1,
  "Bradesco": 6,
  "XP Inc.": 3,
  "Sicredi": 12,
  "Ambev": 19,
  "Banco Inter": 9,
  "Gerdau": 5,
  "Natura &Co": 24,
  "WEG": 15,
  "Globo": 4,
  "Cielo": 30,
  "Localiza": 8,
};

export function buildDemoJobs(now = Date.now()): Job[] {
  const day = 86_400_000;
  return ROWS.map((r, i) => {
    const [company, category, title, location, region, level, status, daysAgo, match, reason, remote] = r;
    const seen = new Date(now - daysAgo * day).toISOString();
    const statusDays = status === "new" ? daysAgo : Math.max(0.1, daysAgo / 3);
    return {
      id: i + 1,
      source: "demo",
      company,
      company_category: category,
      title,
      url: "",
      location,
      region,
      remote: Boolean(remote) || /remot/i.test(location),
      level,
      posted_at: new Date(now - (daysAgo + 1) * day).toISOString(),
      deadline:
        region === "br" && company in DEADLINE_DAYS
          ? new Date(now + DEADLINE_DAYS[company] * day).toISOString()
          : null,
      first_seen: seen,
      is_active: !(status === "closed" && i % 2 === 0),
      status,
      status_changed_at: new Date(now - statusDays * day).toISOString(),
      notes: status === "process" ? "Case: API de pagamentos em Python. Revisar idempotência e filas." : "",
      ai_match: match,
      ai_reason: reason,
    };
  });
}
