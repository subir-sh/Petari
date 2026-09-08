# Petari

**Lightweight Markdown stickies for your desktop.**

Petari is a lightweight desktop app for keeping notes and small tasks visible directly on your desktop.

Instead of becoming another project management tool, Petari focuses on the immediacy of Sticky Notes: see what matters, edit it instantly, and keep every note as a plain Markdown file.

## Concept

Each sticky is a single `.md` file.

```text
notes/
├─ today.md
├─ ideas.md
└─ project-a.md
```

The Markdown file is the source of truth. It stores both the note content and Petari-specific display state.

```md
---
title: Today
petari:
  x: 420
  y: 180
  width: 320
  height: 260
  alwaysOnTop: true
---

- ~~Review yesterday's work~~
- **Fix login issue**
- Update documentation
```

Petari-specific state lives under the `petari` namespace so ordinary Markdown metadata can coexist with the app without collision.

There is no separate database. Files remain readable and editable with other tools such as VS Code or Obsidian.

## Architecture

Petari uses Tauri 2 for the desktop shell and native OS integration, with a React + Vite frontend for the sticky UI.

```text
                              PETARI
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
              Tauri 2 / Rust             React + Vite
                   │                           │
        ┌──────────┼──────────┐          Sticky UI
        │          │          │               │
     Windows    File I/O   Clipboard     WYSIWYG Editor
     & Tray        │          │               │
        │          │          │               │
        └──────────┴─────┬────┴───────────────┘
                         │
                  Markdown files
                         │
             ┌───────────┼───────────┐
             │           │           │
          note-a.md   note-b.md   note-c.md
```

The intended mapping is simple:

```text
1 Markdown file = 1 sticky = 1 desktop window
```

Tauri is responsible for native windows, filesystem access, clipboard integration, tray behavior, and other OS-level features. React is responsible for rendering and editing the note itself.

## Storage

A sticky's position and size are stored inside its Markdown frontmatter.

```yaml
petari:
  x: 420
  y: 180
  width: 320
  height: 260
  alwaysOnTop: true
```

While a sticky is being dragged or resized, only the live window state changes. When the interaction ends, Petari writes the final state back to the Markdown file.

Petari stores the current state, not movement history.

## Goals

- Keep important notes immediately visible on the desktop
- Stay fast, lightweight, and low-friction
- Store each sticky as an independent Markdown file
- Avoid proprietary data formats and hidden databases
- Support natural WYSIWYG editing for basic Markdown formatting
- Preserve rich-text formatting when copying to compatible apps
- Keep Petari metadata namespaced and portable

## MVP

- Create and delete Markdown stickies
- Load one Markdown file as one desktop window
- Restore sticky position and size from `petari` frontmatter
- Persist drag and resize state back to the Markdown file
- WYSIWYG Markdown editing
- Bold and strikethrough
- Always-on-top mode
- Load Markdown files from a selected folder
- Reflect external file changes automatically
- Rich-text clipboard support
- System tray entry for creating and reopening stickies

## Planned Stack

- **Tauri 2** — desktop shell and native integration
- **React + TypeScript** — UI
- **Vite** — frontend tooling
- **Tiptap** — WYSIWYG editor
- **Markdown + YAML frontmatter** — persistent note format

## Philosophy

Petari is not intended to replace tools such as Notion, Trello, or Jira.

Its goal is much simpler:

> Put what matters on the screen, see it, and edit it immediately.

Petari combines the openness of Markdown files with the immediacy of desktop sticky notes.
