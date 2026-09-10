import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { documentDir, join } from "@tauri-apps/api/path";
import {
  availableMonitors,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import type { StickyEditorHandle } from "./components/StickyEditor";
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
const LIST_VISIBLE_KEY = "petari:listVisible";
const StickyEditor = lazy(() => import("./components/StickyEditor"));

type StickyFile = {
  path: string;
  number: number;
  document: StickyDocument;
};

type MonitorInfo = Awaited<ReturnType<typeof availableMonitors>>[number];

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

function safePosition(
  metadata: PetariMetadata,
  monitors: MonitorInfo[],
  fallback: MonitorInfo | null,
) {
  const minVisibleWidth = Math.min(metadata.width, 80);
  const minVisibleHeight = Math.min(metadata.height, 34);
  const visible = monitors.some(({ workArea }) => {
    const left = Math.max(metadata.x, workArea.position.x);
    const top = Math.max(metadata.y, workArea.position.y);
    const right = Math.min(metadata.x + metadata.width, workArea.position.x + workArea.size.width);
    const bottom = Math.min(metadata.y + metadata.height, workArea.position.y + workArea.size.height);
    return right - left >= minVisibleWidth && bottom - top >= minVisibleHeight;
  });

  if (visible || !fallback) return { x: metadata.x, y: metadata.y, recovered: false };

  const { position, size } = fallback.workArea;
  const maxX = position.x + Math.max(0, size.width - metadata.width);
  const maxY = position.y + Math.max(0, size.height - metadata.height);
  return {
    x: Math.min(Math.max(metadata.x, position.x), maxX),
    y: Math.min(Math.max(metadata.y, position.y), maxY),
    recovered: true,
  };
}

async function desktopMonitors() {
  const monitors = await availableMonitors();
  const fallback = (await primaryMonitor()) ?? monitors[0] ?? null;
  return { monitors, fallback };
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
  const numbers = new Set(
    entries
      .filter((entry) => entry.isFile && /^\d+\.md$/i.test(entry.name))
      .map((entry) => Number(entry.name.replace(/\.md$/i, ""))),
  );

  let next = 1;
  while (numbers.has(next)) next += 1;
  return join(directory, `${next}.md`);
}

async function openStickyWindow(path: string, metadata: PetariMetadata) {
  const label = `sticky-${stickyNumber(path)}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.unminimize();
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
    skipTaskbar: true,
  });
}

function createListWindow(visible = true) {
  return new WebviewWindow("list", {
    url: "index.html?list=1",
    title: "Petari",
    width: 320,
    height: 420,
    minWidth: 260,
    minHeight: 280,
    decorations: false,
    resizable: true,
    visible,
    focus: visible,
  });
}

async function openListWindow() {
  localStorage.setItem(LIST_VISIBLE_KEY, "true");
  const existing = await WebviewWindow.getByLabel("list");
  if (existing) {
    await existing.unminimize();
    await existing.setFocus();
    return;
  }

  createListWindow();
}

async function ensureListTaskbarHost() {
  const existing = await WebviewWindow.getByLabel("list");
  if (existing) return;

  localStorage.setItem(LIST_VISIBLE_KEY, "false");
  const listWindow = createListWindow(false);
  listWindow.once("tauri://created", () => {
    void (async () => {
      await listWindow.show();
      await listWindow.minimize();
    })();
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
        await ensureListTaskbarHost();
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
  const [query, setQuery] = useState("");
  const activatingRef = useRef(false);

  const reload = async () => setStickies(await loadStickies());

  useEffect(() => {
    if (localStorage.getItem(LIST_VISIBLE_KEY) !== "false") void reload();
    const handleFocus = () => {
      if (activatingRef.current) return;
      activatingRef.current = true;

      void (async () => {
        try {
          const windows = await getAllWebviewWindows();
          const stickyWindows = windows.filter((appWindow) => appWindow.label.startsWith("sticky-"));

          for (const appWindow of stickyWindows) {
            await appWindow.unminimize();
            await appWindow.setFocus();
          }

          const listWindow = getCurrentWindow();
          const keepListVisible = localStorage.getItem(LIST_VISIBLE_KEY) !== "false" || stickyWindows.length === 0;
          if (keepListVisible) {
            await reload();
            localStorage.setItem(LIST_VISIBLE_KEY, "true");
            await listWindow.setFocus();
          } else {
            await listWindow.minimize();
          }
        } finally {
          window.setTimeout(() => {
            activatingRef.current = false;
          }, 50);
        }
      })();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
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

  const deleteSticky = async (sticky: StickyFile) => {
    const stickyWindow = await WebviewWindow.getByLabel(`sticky-${sticky.number}`);
    if (stickyWindow) await stickyWindow.destroy();
    await remove(sticky.path);
    await reload();
  };

  const showAll = async () => {
    const { monitors, fallback } = await desktopMonitors();
    const currentStickies = await loadStickies();

    for (const sticky of currentStickies) {
      const appWindow = await WebviewWindow.getByLabel(`sticky-${sticky.number}`);
      if (!appWindow) continue;

      await appWindow.unminimize();
      const position = safePosition(sticky.document.petari, monitors, fallback);
      if (position.recovered) {
        sticky.document.petari.x = position.x;
        sticky.document.petari.y = position.y;
        await writeTextFile(sticky.path, serializeStickyDocument(sticky.document));
        await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
      }
      await appWindow.setFocus();
    }
  };

  const hideList = async () => {
    localStorage.setItem(LIST_VISIBLE_KEY, "false");
    await getCurrentWindow().minimize();
  };

  const quit = async () => {
    const windows = await getAllWebviewWindows();
    await Promise.all(windows.map((appWindow) => appWindow.destroy()));
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredStickies = normalizedQuery
    ? stickies.filter((sticky) =>
        String(sticky.number).includes(normalizedQuery)
        || sticky.document.body.toLowerCase().includes(normalizedQuery))
    : stickies;

  return (
    <main className="note-list">
      <header className="note-list__titlebar" data-tauri-drag-region>
        <span className="note-list__title" data-tauri-drag-region>Petari</span>
        <button className="icon-button" title="Close list" onClick={hideList}>×</button>
      </header>

      <div className="note-list__search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes..."
          aria-label="Search notes"
        />
      </div>

      <div className="note-list__items">
        {filteredStickies.map((sticky) => (
          <div key={sticky.path} className="note-list__item">
            <button className="note-list__open" onClick={() => openSticky(sticky)}>
              <span className="note-list__number">{sticky.number}</span>
              <span className="note-list__preview">{preview(sticky.document.body)}</span>
            </button>
            <button className="note-list__delete" title="Delete note" onClick={() => deleteSticky(sticky)}>×</button>
          </div>
        ))}
      </div>

      <footer className="note-list__footer">
        <button onClick={createSticky}>+ New</button>
        <button onClick={showAll}>Show all</button>
        <button onClick={quit}>Quit</button>
      </footer>
    </main>
  );
}

function StickyView({ path }: { path: string }) {
  const [sticky, setSticky] = useState<StickyFile | null>(null);
  const stickyRef = useRef<StickyFile | null>(null);
  const editorRef = useRef<StickyEditorHandle | null>(null);
  const saveTimer = useRef<number | null>(null);

  const syncEditorBody = () => {
    const current = stickyRef.current;
    if (!current) return null;
    const body = editorRef.current?.getMarkdown();
    if (body !== undefined) current.document.body = body;
    return current;
  };

  const persist = () => {
    if (editorRef.current?.isComposing()) return;
    const current = syncEditorBody();
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
      const { monitors, fallback } = await desktopMonitors();
      const position = safePosition(document.petari, monitors, fallback);

      if (position.recovered) {
        document.petari.x = position.x;
        document.petari.y = position.y;
        await writeTextFile(path, serializeStickyDocument(document));
      }

      await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
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

  const updateBody = () => schedulePersist();

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
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const current = syncEditorBody();
    if (!current) return;
    current.document.petari.open = false;
    await writeTextFile(current.path, serializeStickyDocument(current.document));
    await getCurrentWindow().close();
  };

  if (!sticky) return <main className="sticky" />;

  return (
    <main className={`sticky sticky--${sticky.document.petari.color}`}>
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span className="sticky__title" data-tauri-drag-region>{sticky.number}</span>

        <div className="sticky__format-actions" onMouseDown={(event) => event.preventDefault()}>
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

        <div className="sticky__window-actions" onMouseDown={(event) => event.preventDefault()}>
          <button className="icon-button sticky__secondary-control" title="Notes list" onClick={openListWindow}>☷</button>
          <button className="icon-button" title="New sticky" onClick={createSticky}>+</button>
          <button className="icon-button sticky__secondary-control" title="Always on top" onClick={toggleAlwaysOnTop}>
            {sticky.document.petari.alwaysOnTop ? "●" : "○"}
          </button>
          <button className="icon-button sticky__secondary-control" title="Minimize" onClick={() => getCurrentWindow().minimize()}>−</button>
          <button className="icon-button" title="Close" onClick={closeSticky}>×</button>
        </div>
      </header>
      <Suspense fallback={<section className="sticky__editor-shell" />}>
        <StickyEditor ref={editorRef} markdown={sticky.document.body} onUpdate={updateBody} />
      </Suspense>
    </main>
  );
}

function App() {
  if (IS_LIST) return <ListView />;
  if (INITIAL_PATH) return <StickyView path={INITIAL_PATH} />;
  return <Bootstrap />;
}

export default App;
