import { useEffect, useRef, useState } from "react";
import { documentDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import StickyEditor, { type StickyEditorHandle } from "./components/StickyEditor";
import {
  DEFAULT_PETARI_METADATA,
  parseStickyDocument,
  serializeStickyDocument,
  type StickyDocument,
} from "./lib/stickyDocument";

const INITIAL_PATH = new URLSearchParams(window.location.search).get("path");

type OpenSticky = {
  path: string;
  document: StickyDocument;
};

function stickyNumber(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "";
}

function emptyDocument(): StickyDocument {
  return {
    metadata: {},
    petari: { ...DEFAULT_PETARI_METADATA },
    body: "",
  };
}

async function petariDirectory() {
  const directory = await join(await documentDir(), "Petari");
  await mkdir(directory, { recursive: true });
  return directory;
}

async function defaultSticky() {
  const path = await join(await petariDirectory(), "1.md");

  try {
    return { path, source: await readTextFile(path) };
  } catch {
    const source = serializeStickyDocument(emptyDocument());
    await writeTextFile(path, source);
    return { path, source };
  }
}

async function nextStickyPath() {
  const directory = await petariDirectory();
  let number = 1;

  while (true) {
    const path = await join(directory, `${number}.md`);
    try {
      await readTextFile(path);
      number += 1;
    } catch {
      return path;
    }
  }
}

function openStickyWindow(path: string) {
  new WebviewWindow(`sticky-${crypto.randomUUID()}`, {
    url: `index.html?path=${encodeURIComponent(path)}`,
    title: stickyNumber(path),
    width: DEFAULT_PETARI_METADATA.width,
    height: DEFAULT_PETARI_METADATA.height,
    minWidth: 240,
    minHeight: 180,
    decorations: false,
    resizable: true,
  });
}

function App() {
  const [sticky, setSticky] = useState<OpenSticky | null>(null);
  const stickyRef = useRef<OpenSticky | null>(null);
  const editorRef = useRef<StickyEditorHandle | null>(null);
  const saveTimer = useRef<number | null>(null);

  const persist = () => {
    const current = stickyRef.current;
    if (!current) return;
    void writeTextFile(current.path, serializeStickyDocument(current.document));
  };

  const schedulePersist = () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(persist, 250);
  };

  useEffect(() => {
    void (async () => {
      const loaded = INITIAL_PATH
        ? { path: INITIAL_PATH, source: await readTextFile(INITIAL_PATH) }
        : await defaultSticky();
      const document = parseStickyDocument(loaded.source);
      const appWindow = getCurrentWindow();

      await appWindow.setPosition(new PhysicalPosition(document.petari.x, document.petari.y));
      await appWindow.setSize(new PhysicalSize(document.petari.width, document.petari.height));
      await appWindow.setAlwaysOnTop(document.petari.alwaysOnTop);

      const next = { path: loaded.path, document };
      stickyRef.current = next;
      setSticky(next);
    })();
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const listeners = Promise.all([
      appWindow.onMoved(({ payload }) => {
        if (!stickyRef.current) return;
        stickyRef.current.document.petari.x = payload.x;
        stickyRef.current.document.petari.y = payload.y;
        schedulePersist();
      }),
      appWindow.onResized(({ payload }) => {
        if (!stickyRef.current) return;
        stickyRef.current.document.petari.width = payload.width;
        stickyRef.current.document.petari.height = payload.height;
        schedulePersist();
      }),
    ]);

    return () => {
      void listeners.then((unlisten) => unlisten.forEach((fn) => fn()));
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const updateBody = (body: string) => {
    if (!stickyRef.current) return;
    stickyRef.current.document.body = body;
    setSticky({ ...stickyRef.current });
    schedulePersist();
  };

  const toggleAlwaysOnTop = async () => {
    if (!stickyRef.current) return;
    const value = !stickyRef.current.document.petari.alwaysOnTop;
    stickyRef.current.document.petari.alwaysOnTop = value;
    setSticky({ ...stickyRef.current });
    await getCurrentWindow().setAlwaysOnTop(value);
    persist();
  };

  const createSticky = async () => {
    const path = await nextStickyPath();
    await writeTextFile(path, serializeStickyDocument(emptyDocument()));
    openStickyWindow(path);
  };

  if (!sticky) return <main className="sticky" />;

  return (
    <main className="sticky">
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span className="sticky__title" data-tauri-drag-region>{stickyNumber(sticky.path)}</span>
        <div className="sticky__actions">
          <button className="icon-button" title="New sticky" onClick={createSticky}>+</button>
          <button
            className="icon-button"
            title="Bold"
            onMouseDown={(event) => {
              event.preventDefault();
              editorRef.current?.toggleBold();
            }}
          >
            <strong>B</strong>
          </button>
          <button
            className="icon-button"
            title="Strikethrough"
            onMouseDown={(event) => {
              event.preventDefault();
              editorRef.current?.toggleStrike();
            }}
          >
            <s>S</s>
          </button>
          <button className="icon-button" title="Always on top" onClick={toggleAlwaysOnTop}>
            {sticky.document.petari.alwaysOnTop ? "●" : "○"}
          </button>
          <button className="icon-button" title="Close" onClick={() => getCurrentWindow().close()}>×</button>
        </div>
      </header>
      <StickyEditor ref={editorRef} markdown={sticky.document.body} onChange={updateBody} />
    </main>
  );
}

export default App;
