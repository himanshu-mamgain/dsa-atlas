/**
 * The app ecosystem: Himanshu's learning apps, linked to each other.
 * Each app keeps its own data on the device; they connect through links.
 * docs/ecosystem.md describes this contract; Structura carries the same list.
 */

export type EcoAppId = "structura" | "dsa-atlas";

export interface EcoApp {
  id: EcoAppId;
  name: string;
  url: string;
  tagline: string;
  /** Accent used for the app's tile in the switcher. */
  color: string;
}

export const ECOSYSTEM: EcoApp[] = [
  {
    id: "dsa-atlas",
    name: "DSA Atlas",
    url: "https://dsa-atz.netlify.app",
    tagline: "DSA notes: brute force → optimal, complexity, revision",
    color: "#34d399",
  },
  {
    id: "structura",
    name: "Structura",
    url: "https://structura-web.netlify.app",
    tagline: "System design you can see working",
    color: "#a78bfa",
  },
];

export const appUrl = (id: EcoAppId) => ECOSYSTEM.find((a) => a.id === id)!.url;

/** Deep links between the apps. Keep these stable: the other app builds them. */
export const ecoLinks = {
  /** Structura topic page. */
  structuraTopic: (topicId: string) => `${appUrl("structura")}/?topic=${encodeURIComponent(topicId)}`,
  /** DSA Atlas problems linked to a Structura topic. */
  dsaProblemsForTopic: (topicId: string) => `${appUrl("dsa-atlas")}/?page=problems&structura=${encodeURIComponent(topicId)}`,
  /** One DSA Atlas problem. */
  dsaProblem: (problemId: string) => `${appUrl("dsa-atlas")}/?problem=${encodeURIComponent(problemId)}`,
};
