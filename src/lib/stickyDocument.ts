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

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePetariMetadata(value: unknown): PetariMetadata {
  const raw = isRecord(value) ? value : {};

  return {
    x: finiteNumber(raw.x, DEFAULT_PETARI_METADATA.x),
    y: finiteNumber(raw.y, DEFAULT_PETARI_METADATA.y),
    width: finiteNumber(raw.width, DEFAULT_PETARI_METADATA.width),
    height: finiteNumber(raw.height, DEFAULT_PETARI_METADATA.height),
    alwaysOnTop: booleanValue(raw.alwaysOnTop, DEFAULT_PETARI_METADATA.alwaysOnTop),
  };
}

export function parseStickyDocument(source: string): StickyDocument {
  const match = source.match(FRONTMATTER_PATTERN);

  if (!match) {
    return {
      metadata: {},
      petari: { ...DEFAULT_PETARI_METADATA },
      body: source,
    };
  }

  const parsed = parse(match[1]);
  const metadata = isRecord(parsed) ? parsed : {};

  return {
    metadata,
    petari: normalizePetariMetadata(metadata.petari),
    body: source.slice(match[0].length),
  };
}

export function serializeStickyDocument(document: StickyDocument): string {
  const metadata = {
    ...document.metadata,
    petari: document.petari,
  };

  const frontmatter = stringify(metadata).trimEnd();

  return `---\n${frontmatter}\n---\n${document.body}`;
}
