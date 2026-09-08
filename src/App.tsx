import { useEffect, useRef, useState } from "react";
import { documentDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import StickyEditor from "./components/StickyEditor";
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

function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function emptyDocument(): StickyDocument {
  return {
    metadata: {},
    petari: { ...DEFAULT_PETARI_METADATA },
    body: "",
  };
}

async function defaultSticky() {
  const directory = await join(await documentDir(), "Petari");
  const path = await join(directory, "note.md");

  try {
    return { path, source: await readTextFile(path) };
  } catch {
    const document = emptyDocument();
    const source = serializeStickyDocument(document);
    await mkdir(directory, { recursive: true });
    await writeTextFile(path, source);
    return { path, source };
  }
}

function openStickyWindow(path: string) {
  new WebviewWindow(`sticky-${crypto.randomUUID()}`, {
    url: `index.html?path=${encodeURIComponent(path)}`,
    title: fileName(path),
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

  const createMarkdown = async () => {
    const path = await save({ defaultPath: "note.md" });
    if (!path) return;
    await writeTextFile(path, serializeStickyDocument(emptyDocument()));
    openStickyWindow(path);
  };

  const openMarkdown = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (typeof path === "string") openStickyWindow(path);
  };

  if (!sticky) return <main className="sticky" />;

  const title = typeof sticky.document.metadata.title === "string"
    ? sticky.document.metadata.title
    : fileName(sticky.path);

  return (
    <main className="sticky">
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span className="sticky__title" data-tauri-drag-region>{title}</span>
        <div className="sticky__actions">
          <button className="icon-button" title="New sticky" onClick={createMarkdown}>+</button>
          <button className="icon-button" title="Open Markdown" onClick={openMarkdown}>↗</button>
          <button className="icon-button" title="Always on top" onClick={toggleAlwaysOnTop}>
            {sticky.document.petari.alwaysOnTop ? "●" : "○"}
          </button>
          <button className="icon-button" title="Close" onClick={() => getCurrentWindow().close()}>×</button>
        </div>
      </header>
      <StickyEditor markdown={sticky.document.body} onChange={updateBody} />
    </main>
  );
}

export default App;
