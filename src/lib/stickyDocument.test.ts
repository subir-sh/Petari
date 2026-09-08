import { describe, expect, it } from "vitest";
import {
  DEFAULT_PETARI_METADATA,
  parseStickyDocument,
  serializeStickyDocument,
} from "./stickyDocument";

describe("stickyDocument", () => {
  it("uses defaults for plain Markdown", () => {
    const source = "# Note\n\nHello";
    const document = parseStickyDocument(source);

    expect(document.metadata).toEqual({});
    expect(document.petari).toEqual(DEFAULT_PETARI_METADATA);
    expect(document.body).toBe(source);
  });

  it("reads namespaced Petari metadata without losing ordinary frontmatter", () => {
    const source = `---\ntitle: Weekly Notes\ntags:\n  - work\npetari:\n  x: 420\n  y: 180\n  width: 320\n  height: 260\n  alwaysOnTop: true\n---\n\n- **Important**\n`;
    const document = parseStickyDocument(source);

    expect(document.metadata.title).toBe("Weekly Notes");
    expect(document.metadata.tags).toEqual(["work"]);
    expect(document.petari).toEqual({
      x: 420,
      y: 180,
      width: 320,
      height: 260,
      alwaysOnTop: true,
    });
    expect(document.body).toBe("\n- **Important**\n");
  });

  it("preserves regular metadata when Petari state changes", () => {
    const document = parseStickyDocument(`---\ntitle: Ideas\n---\n\nHello\n`);

    document.petari.x = 800;
    document.petari.y = 240;

    const reparsed = parseStickyDocument(serializeStickyDocument(document));

    expect(reparsed.metadata.title).toBe("Ideas");
    expect(reparsed.petari.x).toBe(800);
    expect(reparsed.petari.y).toBe(240);
    expect(reparsed.body).toBe("\nHello\n");
  });

  it("falls back only for invalid Petari fields", () => {
    const document = parseStickyDocument(`---\npetari:\n  x: nope\n  y: 50\n  alwaysOnTop: nope\n---\nText`);

    expect(document.petari.x).toBe(DEFAULT_PETARI_METADATA.x);
    expect(document.petari.y).toBe(50);
    expect(document.petari.alwaysOnTop).toBe(false);
  });
});
