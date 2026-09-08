# Petari

**Lightweight Markdown stickies for your desktop.**

Petari is a tiny Windows desktop app that keeps Markdown notes visible like sticky notes. Each sticky is a plain `.md` file; there is no database or proprietary note format.

## Run on Windows

```text
git pull
→ double-click Petari.exe
```

`Petari.exe` is kept in the repository root. When the source changes, GitHub Actions rebuilds the Windows executable and commits the new binary back to the repository.

On first launch Petari creates and opens:

```text
Documents/Petari/note.md
```

## Concept

One Markdown file is one sticky window.

```text
notes/
├─ today.md
├─ ideas.md
└─ project-a.md
```

The Markdown file stores both content and Petari-specific window state.

```md
---
title: Today
petari:
  x: 420
  y: 180
  width: 320
  height: 260
  alwaysOnTop: false
---

- ~~Finished task~~
- **Important task**
- Another task
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
- Create/open Markdown stickies
- WYSIWYG Markdown editing
- Bold and strikethrough
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
