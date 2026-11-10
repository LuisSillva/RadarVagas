// Leitura das respostas de cada ATS, com payloads no formato real das APIs.
import { describe, expect, it } from "vitest";
import {
  parseAshby,
  parseEightfold,
  parseGreenhouse,
  parseLever,
  parseSmartRecruiters,
  parseWorkday,
} from "../sources/boards";
import { matchGupyCompany, parseGupyJob } from "../sources/gupy";
import type { CompanySource } from "../types";

const GUPY_ITEM = {
  id: 9876543,
  name: "Estágio em Engenharia de Software",
  careerPageName: "Itaú Unibanco",
  careerPageUrl: "https://vemproitau.gupy.io",
  type: "vacancy_type_internship",
  publishedDate: "2026-10-28T13:00:00.000Z",
  applicationDeadline: "2026-11-30",
  isRemoteWork: false,
  city: "São Paulo",
  state: "São Paulo",
  country: "Brasil",
  jobUrl: "https://vemproitau.gupy.io/jobs/9876543",
  workplaceType: "hybrid",
};

describe("Gupy", () => {
  const sources: CompanySource[] = [
    { company: "Itaú Unibanco", category: "bank", ats: "gupy", match: ["itau"] },
    { company: "WEG", category: "multinational", ats: "gupy", match: ["weg"] },
  ];

  it("lê a vaga e acha a empresa", () => {
    expect(matchGupyCompany(GUPY_ITEM, sources)?.company).toBe("Itaú Unibanco");
    const job = parseGupyJob(GUPY_ITEM, "Itaú Unibanco");
    expect(job.levelHint).toBe("intern");
    expect(job.location).toBe("São Paulo, São Paulo");
    expect(job.postedAt).toBe("2026-10-28T13:00:00.000Z");
  });

  it("casa só palavra inteira", () => {
    expect(matchGupyCompany({ careerPageName: "Norwegian Air" }, sources)).toBeNull();
    expect(
      matchGupyCompany({ careerPageName: "WEG S.A.", careerPageUrl: "https://weg.gupy.io" }, sources)?.company,
    ).toBe("WEG");
  });

  it("prazo só com data vale até o fim do dia em Brasília", () => {
    expect(parseGupyJob(GUPY_ITEM, "X").deadline).toBe("2026-12-01T02:59:59.000Z");
    expect(parseGupyJob({ ...GUPY_ITEM, applicationDeadline: null }, "X").deadline).toBeNull();
  });

  it("remoto sem cidade vira 'Remoto'", () => {
    const job = parseGupyJob({ ...GUPY_ITEM, city: undefined, state: undefined, workplaceType: "remote" }, "X");
    expect(job.remote).toBe(true);
    expect(job.location).toBe("Remoto");
  });
});

it("Greenhouse", () => {
  const [job] = parseGreenhouse(
    {
      jobs: [
        {
          id: 7012345,
          title: "Software Engineer Intern",
          absolute_url: "https://boards.greenhouse.io/nubank/jobs/7012345",
          location: { name: "São Paulo, Brazil" },
          first_published: "2026-10-20T10:00:00-04:00",
        },
      ],
    },
    "Nubank",
  );
  expect(job.externalId).toBe("7012345");
  expect(job.location).toBe("São Paulo, Brazil");
  expect(job.postedAt).toBe("2026-10-20T14:00:00.000Z");
});

it("Lever", () => {
  const [job] = parseLever(
    [
      {
        id: "abc-123",
        text: "Software Engineer, Intern",
        hostedUrl: "https://jobs.lever.co/palantir/abc-123",
        categories: { location: "London, UK", commitment: "Internship" },
        createdAt: 1761000000000,
        country: "GB",
        workplaceType: "onsite",
      },
    ],
    "Palantir",
  );
  expect(job.levelHint).toBe("intern");
  expect(job.country).toBe("GB");
  expect(job.postedAt).not.toBeNull();
});

it("Ashby ignora vagas escondidas", () => {
  const jobs = parseAshby(
    {
      jobs: [
        {
          id: "u-1",
          title: "Research Engineer Intern",
          location: "San Francisco",
          employmentType: "Intern",
          isRemote: false,
          isListed: true,
          publishedAt: "2026-10-01T00:00:00.000+00:00",
          jobUrl: "https://jobs.ashbyhq.com/openai/u-1",
          address: { postalAddress: { addressCountry: "United States" } },
        },
        { id: "u-2", title: "Hidden", isListed: false },
      ],
    },
    "OpenAI",
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0].levelHint).toBe("intern");
  expect(jobs[0].country).toBe("United States");
});

it("SmartRecruiters", () => {
  const [job] = parseSmartRecruiters(
    {
      totalFound: 1,
      content: [
        {
          id: "744000",
          name: "Software Engineer Intern",
          releasedDate: "2026-10-10T08:00:00.000Z",
          location: { city: "Campinas", country: "br", remote: false },
          experienceLevel: { id: "internship" },
          company: { identifier: "BoschGroup" },
        },
      ],
    },
    "Bosch",
  );
  expect(job.country).toBe("BR");
  expect(job.levelHint).toBe("intern");
  expect(job.url.endsWith("/BoschGroup/744000")).toBe(true);
});

it("Workday", () => {
  const [job] = parseWorkday(
    {
      jobPostings: [
        {
          title: "Software Engineering Intern - Fall 2027",
          externalPath: "/job/US-CA-Santa-Clara/Software-Engineering-Intern_JR2001234",
          locationsText: "US, CA, Santa Clara",
        },
      ],
    },
    "NVIDIA",
    "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
  );
  expect(job.externalId).toBe("NVIDIA:JR2001234");
  expect(job.url.startsWith("https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/")).toBe(true);
});

it("Eightfold: formatos v2 e pcsx", () => {
  const [v2] = parseEightfold(
    {
      positions: [
        {
          id: 1970393556625300,
          ats_job_id: "200012345",
          name: "Software Engineer: Internship Opportunities",
          locations: ["Redmond, Washington, United States"],
          t_create: 1761000000,
          canonicalPositionUrl: "https://apply.careers.microsoft.com/careers/job/1970393556625300",
          work_location_option: "onsite",
        },
      ],
    },
    "Microsoft",
    "apply.careers.microsoft.com",
  );
  expect(v2.externalId).toBe("Microsoft:200012345");
  expect(v2.remote).toBe(false);
  expect(v2.postedAt?.startsWith("2025")).toBe(true);

  const [pcsx] = parseEightfold(
    {
      data: {
        positions: [
          {
            id: 790300000001,
            name: "Software Engineering Intern",
            locations: ["Remote, Brazil"],
            postedTs: 1761000000,
            positionUrl: "/careers/job/790300000001",
            workLocationOption: "remote",
          },
        ],
      },
    },
    "Netflix",
    "explore.jobs.netflix.net",
  );
  expect(pcsx.remote).toBe(true);
  expect(pcsx.url).toBe("https://explore.jobs.netflix.net/careers/job/790300000001");
});
