import { describe, expect, it } from "vitest";
import { classifyDev, classifyLevel, classifyRegion, classifyRemote } from "../classify";

describe("nível", () => {
  it.each([
    ["Estágio em Desenvolvimento de Software", "intern"],
    ["Estagiário(a) de Tecnologia", "intern"],
    ["Software Engineering Intern - Summer 2027", "intern"],
    ["Bolsa de Iniciação em Dados", "intern"],
    ["Jovem Aprendiz - TI", "intern"],
    ["Programa Trainee Tecnologia 2027", "trainee"],
    ["Software Engineer, New Grad", "trainee"],
    ["Pessoa Desenvolvedora Back-end Júnior", "junior"],
    ["Desenvolvedor Jr. Python", "junior"],
    ["Software Engineer I", "junior"],
    ["Software Engineer II", null],
    ["Senior Software Engineer", null],
    ["Desenvolvedor Pleno Java", null],
    ["Staff Engineer, Platform", null],
    ["Software Engineer", null],
    ["Engineering Manager", null],
  ])("%s → %s", (title, expected) => {
    expect(classifyLevel(title)).toBe(expected);
  });

  it("dica do ATS vale", () => {
    expect(classifyLevel("Programa 2027", "intern")).toBe("intern");
    expect(classifyLevel("Analista", "junior")).toBe("junior");
  });
});

describe("área de dev", () => {
  it.each([
    ["Estágio em Desenvolvimento de Software", "dev"],
    ["Software Engineering Intern", "dev"],
    ["Estágio em Dados", "dev"],
    ["Estágio em Tecnologia", "dev"],
    ["Machine Learning Intern", "dev"],
    ["Estágio em Marketing", "no"],
    ["Sales Development Intern", "no"],
    ["Estágio Jurídico", "no"],
    ["Mechanical Engineering Intern", "no"],
    ["Finance Data Intern", "maybe"],
    ["Estágio 2027", "maybe"],
    ["Programa de Estágio 2027", "maybe"],
    ["Estágio em Administração de Empresas", "no"],
  ])("%s → %s", (title, expected) => {
    expect(classifyDev(title)).toBe(expected);
  });
});

describe("região", () => {
  it.each([
    ["São Paulo, SP", null, "greenhouse", "br"],
    ["Sao Paulo, Brazil", null, "lever", "br"],
    ["Remote - Brazil", null, "ashby", "br"],
    ["Mexico City", null, "greenhouse", "intl"],
    ["Remote - LATAM", null, "greenhouse", "intl"],
    ["Dublin, Ireland", "IE", "smartrecruiters", "intl"],
    ["Curitiba", "BR", "smartrecruiters", "br"],
    ["Remoto", "Brasil", "gupy", "br"],
    [null, null, "gupy", "br"],
  ] as const)("%s / %s / %s → %s", (location, country, source, expected) => {
    expect(classifyRegion({ location, country, source })).toBe(expected);
  });
});

describe("remoto", () => {
  it.each([
    ["Software Engineer Intern", "Remote - Brazil", false, true],
    ["Estágio em Dados", "Remoto", false, true],
    ["Estágio em TI (Home Office)", "Porto Alegre, RS", false, true],
    ["Desenvolvedor Júnior", "São Paulo, SP", true, true],
    ["Desenvolvedor Júnior - Híbrido", "São Paulo, SP", true, false],
    ["Software Engineer Intern", "Hybrid - Dublin", false, false],
    ["Software Engineer Intern", "London, UK", false, false],
    ["Backend Intern", "Anywhere", false, true],
    ["Software Engineer - New Grad, Distributed Data Systems", "Mountain View, California", false, false],
  ])("%s / %s → %s", (title, location, remote, expected) => {
    expect(classifyRemote({ title, location, remote })).toBe(expected);
  });
});
