import topics from "./data/structura-topics.json";

export interface StructuraTopic {
  id: string;
  title: string;
  blurb: string;
}

/** Structura's topics, bundled at build time (see scripts/structura-topics.mjs). */
export const STRUCTURA_TOPICS: StructuraTopic[] = topics;

const byId = new Map(STRUCTURA_TOPICS.map((t) => [t.id, t]));

export const structuraTopic = (id: string): StructuraTopic | undefined => byId.get(id);

/** Title for a topic id; falls back to the id for topics added after this build. */
export const structuraTitle = (id: string) => byId.get(id)?.title ?? id;
