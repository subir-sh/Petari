import { useEffect, useRef, useState } from "react";
import { documentDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import StickyEditor, { type StickyEditorHandle } from "./components/StickyEditor";
import {
  DEFAULT_PETARI_METADATA,
  PETARI_COLORS,
  parseStickyDocument,
  serializeStickyDocument,
  type PetariMetadata,
  type StickyDocument,
} from "./lib/stickyDocument";

const params = new URLSearchParams(window.location.search);
const INITIAL_PATH = params.get("path");
const IS_LIST = params.has("list");

type StickyFile = {
  path: string;
  number: number;
  document: StickyDocument;
};

function stickyNumber(path: string) {
  return Number(path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? 0);
}

function emptyDocument(overrides: Partial<PetariMetadata> = {}): StickyDocument {
  return {
    metadata: {},
    petari: { ...DEFAULT_PETARI_METADATA, ...overrides },
    body: "",
  };
}

async function petariDirectory() {
  const directory = await join(await documentDir(), "Petari");
  await mkdir(directory, { recursive: true });
  return directory;
}

async function loadStickies(): Promise<StickyFile[]> {
  const directory = await petariDirectory();
  const entries = await readDir(directory);
  const markdown = entries
    .filter((entry) => entry.isFile && /^\d+\.md$/i.test(entry.name))
    .sort((a, b) => Number(a.name.replace(/\.md$/i, "")) - Number(b.name.replace(/\.md$/i, "")));

  return Promise.all(markdown.map(async (entry) => {
    const path = await join(directory, entry.name);
    return {
      path,
      number: Number(entry.name.replace(/\.md$/i, "")),
      document: parseStickyDocument(await readTextFile(path)),
    };
  }));
}

async function nextStickyPath() {
  const directory = await petariDirectory();
  const entries = await readDir(directory);
  const numbers = entries
    .filter((entry) => entry.isFile && /^\d+\.md$/i.test(entry.name))
    .map((entry) => Number(entry.name.replace(/\.md$/i, "")));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return join(directory, `${next}.md`);
}

async function openStickyWindow(path: string, metadata: PetariMetadata) {
  const label = `sticky-${stickyNumber(path)}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow(label, {
    url: `index.html?path=${encodeURIComponent(path)}`,
    title: String(stickyNumber(path)),
    x: metadata.x,
    y: metadata.y,
    width: metadata.width,
    height: metadata.height,
    minWidth: 120,
    minHeight: 180,
    decorations: false,
    resizable: true,
  });
}

async function openListWindow() {
  const existing = await WebviewWindow.getByLabel("list");
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow("list", {
    url: "index.html?list=1",
    title: "Petari",
    width: 320,
    height: 420,
    minWidth: 260,
    minHeight: 280,
    decorations: false,
    resizable: true,
  });
}

function Bootstrap() {
  useEffect(() => {
    void (async () => {
      let stickies = await loadStickies();

      if (stickies.length === 0) {
        const path = await nextStickyPath();
        const document = emptyDocument();
        await writeTextFile(path, serializeStickyDocument(document));
        stickies = [{ path, number: 1, document }];
      }

      const open = stickies.filter((sticky) => sticky.document.petari.open);
      if (open.length === 0) {
        await openListWindow();
      } else {
        await Promise.all(open.map((sticky) => openStickyWindow(sticky.path, sticky.document.petari)));
      }

      await getCurrentWindow().destroy();
    })();
  }, []);

  return <main className="bootstrap" />;
}

function preview(body: string) {
  const line = body.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
  if (!line) return "Empty note";
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/, "")
    .replace(/[*_~`]/g, "")
    .slice(0, 64);
}

function ListView() {
  const [stickies, setStickies] = useState<StickyFile[]>([]);

  const reload = async () => setStickies(await loadStickies());

  useEffect(() => {
    void reload();
  }, []);

  const openSticky = async (sticky: StickyFile) => {
    sticky.document.petari.open = true;
    await writeTextFile(sticky.path, serializeStickyDocument(sticky.document));
    await openStickyWindow(sticky.path, sticky.document.petari);
  };

  const createSticky = async () => {
    const path = await nextStickyPath();
    const document = emptyDocument();
    await writeTextFile(path, serializeStickyDocument(document));
    await openStickyWindow(path, document.petari);
    await reload();
  };

  const quit = async () => {
    const windows = await getAllWebviewWindows();
    await Promise.all(windows.map((window) => window.destroy()));
  };

  return (
    <main className="note-list">
      <header className="note-list__titlebar" data-tauri-drag-region>
        <strong data-tauri-drag-region>Petari</strong>
        <button className="icon-button" title="Close" onClick={() => getCurrentWindow().close()}>×</button>
      </header>
      <div className="note-list__items">
        {stickies.map((sticky) => (
          <button key={sticky.path} className="note-list__item" onClick={() => openSticky(sticky)}>
            <span className="note-list__number">{sticky.number}</span>
            <span className="note-list__preview">{preview(sticky.document.body)}</span>
          </button>
        ))}
      </div>
      <footer className="note-list__footer">
        <button onClick={createSticky}>+ New sticky</button>
        <button onClick={quit}>Quit Petari</button>
      </footer>
    </main>
  );
}

function StickyView({ path }: { path: string }) {
  const [sticky, setSticky] = useState<StickyFile | null>(null);
  const stickyRef = useRef<StickyFile | null>(null);
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
      const document = parseStickyDocument(await readTextFile(path));
      const appWindow = getCurrentWindow();

      await appWindow.setPosition(new PhysicalPosition(document.petari.x, document.petari.y));
      await appWindow.setSize(new PhysicalSize(document.petari.width, document.petari.height));
      await appWindow.setAlwaysOnTop(document.petari.alwaysOnTop);

      const next = { path, number: stickyNumber(path), document };
      stickyRef.current = next;
      setSticky(next);
    })();
  }, [path]);

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

  const cycleColor = () => {
    if (!stickyRef.current) return;
    const current = stickyRef.current.document.petari.color;
    const next = PETARI_COLORS[(PETARI_COLORS.indexOf(current) + 1) % PETARI_COLORS.length];
    stickyRef.current.document.petari.color = next;
    setSticky({ ...stickyRef.current });
    persist();
  };

  const createSticky = async () => {
    if (!stickyRef.current) return;
    const current = stickyRef.current.document.petari;
    const document = emptyDocument({
      x: current.x + 24,
      y: current.y + 24,
    });
    const newPath = await nextStickyPath();
    await writeTextFile(newPath, serializeStickyDocument(document));
    await openStickyWindow(newPath, document.petari);
  };

  const closeSticky = async () => {
    if (!stickyRef.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    stickyRef.current.document.petari.open = false;
    await writeTextFile(stickyRef.current.path, serializeStickyDocument(stickyRef.current.document));
    await getCurrentWindow().close();
  };

  if (!sticky) return <main className="sticky" />;

  return (
    <main className={`sticky sticky--${sticky.document.petari.color}`}>
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span className="sticky__title" data-tauri-drag-region>{sticky.number}</span>

        <div className="sticky__format-actions">
          <button className="icon-button" title="Bold" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.toggleBold();
          }}><strong>B</strong></button>
          <button className="icon-button" title="Strikethrough" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.toggleStrike();
          }}><s>S</s></button>
          <button className="icon-button" title="Bullet list" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.toggleBulletList();
          }}>•</button>
          <button className="icon-button icon-button--small-text" title="Numbered list" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.toggleOrderedList();
          }}>1.</button>
          <button className="icon-button" title="Checklist" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.toggleTaskList();
          }}>☑</button>
          <button className="icon-button" title="Change color" onClick={cycleColor}>
            <span className={`color-dot color-dot--${sticky.document.petari.color}`} />
          </button>
        </div>

        <span className="sticky__divider" />

        <div className="sticky__window-actions">
          <button className="icon-button sticky__secondary-control" title="Notes list" onClick={openListWindow}>☷</button>
          <button className="icon-button" title="New sticky" onClick={createSticky}>+</button>
          <button className="icon-button sticky__secondary-control" title="Always on top" onClick={toggleAlwaysOnTop}>
            {sticky.document.petari.alwaysOnTop ? "●" : "○"}
          </button>
          <button className="icon-button" title="Close" onClick={closeSticky}>×</button>
        </div>
      </header>
      <StickyEditor ref={editorRef} markdown={sticky.document.body} onChange={updateBody} />
    </main>
  );
}

function App() {
  if (IS_LIST) return <ListView />;
  if (INITIAL_PATH) return <StickyView path={INITIAL_PATH} />;
  return <Bootstrap />;
}

export default App;
