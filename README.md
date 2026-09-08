# Petari

**Lightweight Markdown stickies for your desktop.**

Petari is a tiny Windows desktop app that keeps Markdown notes visible like sticky notes. Each sticky is a plain `.md` file; there is no database or proprietary note format.

## Run on Windows

```text
git pull
→ double-click Petari.exe
```

`Petari.exe` is kept in the repository root. When the source changes, GitHub Actions rebuilds the Windows executable and commits the new binary back to the repository.

On first launch Petari creates the first sticky automatically. New stickies are created instantly with `+`; there is no Save As dialog.

Internally the files are stored under `Documents/Petari` as `1.md`, `2.md`, `3.md`, and so on. The UI only shows the sticky number, not the file extension or storage path.

## Concept

One Markdown file is one sticky window.

The Markdown file stores both content and Petari-specific window state.

```md
---
petari:
  x: 420
  y: 180
  width: 320
  height: 260
  alwaysOnTop: false
  color: yellow
---

- [ ] Checklist item
- **Important task**
- ~~Finished task~~
```

Petari metadata lives under the `petari` namespace so normal Markdown frontmatter can coexist with it.

## Architecture

```text
                         PETARI
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Tauri 2 / Rust              React + Vite
              │                           │
       native window / fs            WYSIWYG editor
              │                           │
              └─────────────┬─────────────┘
                            │
                       Markdown file
                            │
                   content + petari state
```

```text
1 .md file = 1 sticky = 1 desktop window
```

## Current MVP

- Launch directly as a frameless sticky window
- `+` creates a new sticky immediately
- WYSIWYG Markdown editing
- Bold and strikethrough
- Bullet and numbered lists
- Checklists stored as `- [ ]` / `- [x]`
- List indentation with normal editor keyboard shortcuts
- Undo/redo and standard formatting shortcuts such as `Ctrl+B`
- Five sticky colors stored in `petari.color`
- Drag and resize native windows
- Restore and save position/size through `petari` frontmatter
- Always-on-top toggle
- Autosave note content and window state

## Stack

- Tauri 2
- React + TypeScript
- Vite
- Tiptap
- Markdown + YAML frontmatter

## Philosophy

> Put what matters on the screen, see it, and edit it immediately.
