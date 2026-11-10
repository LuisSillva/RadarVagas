import type { Status } from "@/lib/types";

// Cada etapa usa um tom da paleta: quanto mais avançada a candidatura,
// mais perto da superfície (mais claro).
export const STAGE_COLOR: Record<Status, string> = {
  new: "#0E192F",
  saved: "#0D2653",
  applied: "#0D3978",
  process: "#285395",
  offer: "#4B70B7",
  closed: "#0C0C10",
};
