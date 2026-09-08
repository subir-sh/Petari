import { parse, stringify } from "yaml";

export type PetariMetadata = {
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
};

export type StickyDocument = {
  metadata: Record<string, unknown>;
  petari: PetariMetadata;
  body: string;
};

export const DEFAULT_PETARI_METADATA: PetariMetadata = {
  x: 120,
  y: 120,
  width: 340,
  height: 360,
  alwaysOnTop: false,
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseStickyDocument(source: string): StickyDocument {
  const match = source.match(FRONTMATTER);

  if (!match) {
    return {
      metadata: {},
      petari: { ...DEFAULT_PETARI_METADATA },
      body: source,
    };
  }

  const metadata = (parse(match[1]) ?? {}) as Record<string, unknown>;
  const petari = {
    ...DEFAULT_PETARI_METADATA,
    ...(metadata.petari as Partial<PetariMetadata> | undefined),
  };

  return {
    metadata,
    petari,
    body: source.slice(match[0].length),
  };
}

export function serializeStickyDocument(document: StickyDocument): string {
  const frontmatter = stringify({
    ...document.metadata,
    petari: document.petari,
  }).trimEnd();

  return `---\n${frontmatter}\n---\n${document.body}`;
}
