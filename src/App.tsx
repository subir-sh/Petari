import { useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  parseStickyDocument,
  serializeStickyDocument,
  type StickyDocument,
} from "./lib/stickyDocument";

const SAVE_DELAY_MS = 250;

type OpenSticky = {
  path: string;
  document: StickyDocument;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function App() {
  const [sticky, setSticky] = useState<OpenSticky | null>(null);
  const stickyRef = useRef<OpenSticky | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const persistNow = async () => {
    const current = stickyRef.current;
    if (!current) return;

    await writeTextFile(
      current.path,
      serializeStickyDocument(current.document),
    );
  };

  const schedulePersist = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow();
    }, SAVE_DELAY_MS);
  };

  const openMarkdown = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    const source = await readTextFile(selected);
    const document = parseStickyDocument(source);
    const appWindow = getCurrentWindow();

    await appWindow.setPosition(
      new PhysicalPosition(document.petari.x, document.petari.y),
    );
    await appWindow.setSize(
      new PhysicalSize(document.petari.width, document.petari.height),
    );
    await appWindow.setAlwaysOnTop(document.petari.alwaysOnTop);

    const next = { path: selected, document };
    stickyRef.current = next;
    setSticky(next);
  };

  const updateBody = (body: string) => {
    const current = stickyRef.current;
    if (!current) return;

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

  const closeWindow = async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await persistNow();
    await getCurrentWindow().close();
  };

  useEffect(() => {
    let unlistenMoved: UnlistenFn | undefined;
    let unlistenResized: UnlistenFn | undefined;

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
    };

    void listen();

    return () => {
      unlistenMoved?.();
      unlistenResized?.();

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (!sticky) {
    return (
      <main className="sticky launcher">
        <header className="sticky__titlebar" data-tauri-drag-region>
          <span data-tauri-drag-region>Petari</span>
          <button className="icon-button" type="button" onClick={closeWindow}>
            ×
          </button>
        </header>

        <section className="launcher__content">
          <strong>Markdown stickies for your desktop.</strong>
          <button className="primary-button" type="button" onClick={openMarkdown}>
            Open Markdown file
          </button>
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
            onClick={closeWindow}
          >
            ×
          </button>
        </div>
      </header>

      <textarea
        className="sticky__editor"
        aria-label="Markdown note"
        value={sticky.document.body}
        onChange={(event) => updateBody(event.target.value)}
        spellCheck={false}
      />
    </main>
  );
}

export default App;
