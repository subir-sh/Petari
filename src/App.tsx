import { useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import StickyEditor from "./components/StickyEditor";
import {
  DEFAULT_PETARI_METADATA,
  parseStickyDocument,
  serializeStickyDocument,
  type StickyDocument,
} from "./lib/stickyDocument";

const SAVE_DELAY_MS = 250;
const INITIAL_PATH = new URLSearchParams(window.location.search).get("path");

type OpenSticky = {
  path: string;
  document: StickyDocument;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function openStickyWindow(path: string) {
  const label = `sticky-${crypto.randomUUID()}`;
  const stickyWindow = new WebviewWindow(label, {
    url: `index.html?path=${encodeURIComponent(path)}`,
    title: fileName(path),
    width: DEFAULT_PETARI_METADATA.width,
    height: DEFAULT_PETARI_METADATA.height,
    minWidth: 240,
    minHeight: 180,
    decorations: false,
    resizable: true,
  });

  stickyWindow.once("tauri://error", ({ payload }) => {
    console.error("Failed to create sticky window", payload);
  });
}

function App() {
  const [sticky, setSticky] = useState<OpenSticky | null>(null);
  const stickyRef = useRef<OpenSticky | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);

  const clearScheduledPersist = () => {
    if (saveTimerRef.current === null) return;

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  };

  const persistNow = async () => {
    const current = stickyRef.current;
    if (!current) return;

    await writeTextFile(
      current.path,
      serializeStickyDocument(current.document),
    );
  };

  const schedulePersist = () => {
    clearScheduledPersist();

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow();
    }, SAVE_DELAY_MS);
  };

  const flushAndDestroy = async () => {
    if (closingRef.current) return;
    closingRef.current = true;

    clearScheduledPersist();
    await persistNow();
    await getCurrentWindow().destroy();
  };

  const loadMarkdown = async (path: string) => {
    const source = await readTextFile(path);
    const document = parseStickyDocument(source);
    const appWindow = getCurrentWindow();

    await appWindow.setPosition(
      new PhysicalPosition(document.petari.x, document.petari.y),
    );
    await appWindow.setSize(
      new PhysicalSize(document.petari.width, document.petari.height),
    );
    await appWindow.setAlwaysOnTop(document.petari.alwaysOnTop);

    const next = { path, document };
    stickyRef.current = next;
    setSticky(next);
  };

  const openMarkdown = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });

    if (!selected || Array.isArray(selected)) return;
    openStickyWindow(selected);
  };

  const createMarkdown = async () => {
    const selected = await save({
      defaultPath: "note.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });

    if (!selected) return;

    const document: StickyDocument = {
      metadata: {},
      petari: { ...DEFAULT_PETARI_METADATA },
      body: "",
    };

    await writeTextFile(selected, serializeStickyDocument(document));
    openStickyWindow(selected);
  };

  const updateBody = (body: string) => {
    const current = stickyRef.current;
    if (!current || current.document.body === body) return;

    const next = {
      ...current,
      document: {
        ...current.document,
        body,
      },
    };

    stickyRef.current = next;
    setSticky(next);
    schedulePersist();
  };

  const toggleAlwaysOnTop = async () => {
    const current = stickyRef.current;
    if (!current) return;

    const alwaysOnTop = !current.document.petari.alwaysOnTop;
    const next = {
      ...current,
      document: {
        ...current.document,
        petari: {
          ...current.document.petari,
          alwaysOnTop,
        },
      },
    };

    stickyRef.current = next;
    setSticky(next);

    await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
    await persistNow();
  };

  useEffect(() => {
    if (INITIAL_PATH) {
      void loadMarkdown(INITIAL_PATH);
    }
  }, []);

  useEffect(() => {
    let unlistenMoved: UnlistenFn | undefined;
    let unlistenResized: UnlistenFn | undefined;
    let unlistenClose: UnlistenFn | undefined;

    const listen = async () => {
      const appWindow = getCurrentWindow();

      unlistenMoved = await appWindow.onMoved(({ payload }) => {
        const current = stickyRef.current;
        if (!current) return;

        current.document.petari.x = payload.x;
        current.document.petari.y = payload.y;
        schedulePersist();
      });

      unlistenResized = await appWindow.onResized(({ payload }) => {
        const current = stickyRef.current;
        if (!current) return;

        current.document.petari.width = payload.width;
        current.document.petari.height = payload.height;
        schedulePersist();
      });

      if (INITIAL_PATH) {
        unlistenClose = await appWindow.onCloseRequested((event) => {
          event.preventDefault();
          void flushAndDestroy();
        });
      }
    };

    void listen();

    return () => {
      unlistenMoved?.();
      unlistenResized?.();
      unlistenClose?.();
      clearScheduledPersist();
    };
  }, []);

  if (!sticky && INITIAL_PATH) {
    return (
      <main className="sticky">
        <header className="sticky__titlebar" data-tauri-drag-region>
          <span className="sticky__title" data-tauri-drag-region>
            {fileName(INITIAL_PATH)}
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Close sticky"
            onClick={flushAndDestroy}
          >
            ×
          </button>
        </header>
        <section className="launcher__content">Loading…</section>
      </main>
    );
  }

  if (!sticky) {
    return (
      <main className="sticky launcher">
        <header className="sticky__titlebar" data-tauri-drag-region>
          <span data-tauri-drag-region>Petari</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Close Petari"
            onClick={flushAndDestroy}
          >
            ×
          </button>
        </header>

        <section className="launcher__content">
          <strong>Markdown stickies for your desktop.</strong>
          <div className="launcher__actions">
            <button className="primary-button" type="button" onClick={createMarkdown}>
              New sticky
            </button>
            <button className="secondary-button" type="button" onClick={openMarkdown}>
              Open Markdown
            </button>
          </div>
        </section>
      </main>
    );
  }

  const title =
    typeof sticky.document.metadata.title === "string"
      ? sticky.document.metadata.title
      : fileName(sticky.path);

  return (
    <main className="sticky">
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span className="sticky__title" data-tauri-drag-region>
          {title}
        </span>
        <div className="sticky__actions">
          <button
            className={`icon-button ${sticky.document.petari.alwaysOnTop ? "is-active" : ""}`}
            type="button"
            title="Always on top"
            aria-label="Toggle always on top"
            onClick={toggleAlwaysOnTop}
          >
            ●
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Close sticky"
            onClick={flushAndDestroy}
          >
            ×
          </button>
        </div>
      </header>

      <StickyEditor markdown={sticky.document.body} onChange={updateBody} />
    </main>
  );
}

export default App;
