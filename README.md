# Petari

**Lightweight Markdown stickies for your desktop.**

Petari is a lightweight desktop app for keeping simple notes and tasks visible directly on your desktop.

Instead of becoming another project management tool, Petari focuses on the immediacy of Sticky Notes: see what matters, edit it instantly, and keep each note as a plain Markdown file.

## Concept

Each sticky is a single `.md` file.

```text
notes/
├─ today.md
├─ ideas.md
└─ project-a.md
```

The Markdown file stores both the note content and its display state.

```md
---
x: 420
y: 180
width: 320
height: 260
---

# Today

- ~~Review yesterday's work~~
- **Fix login issue**
- Update documentation
```

There is no separate database. Markdown files are the source of truth, so they remain readable and editable with other tools such as VS Code or Obsidian.

## Goals

- Keep important notes immediately visible on the desktop
- Stay fast, lightweight, and low-friction
- Store each sticky as an independent Markdown file
- Avoid proprietary data formats and hidden databases
- Support natural WYSIWYG editing for basic Markdown formatting
- Preserve rich-text formatting when copying to compatible apps

## MVP

- Create and delete Markdown stickies
- WYSIWYG Markdown editing
- Bold and strikethrough
- Drag and resize stickies
- Persist position and size in Markdown frontmatter
- Always-on-top mode
- Load Markdown files from a selected folder
- Reflect external file changes automatically
- Rich-text clipboard support

## Storage

While a sticky is being dragged or resized, its position is updated only in memory.

When the interaction ends, the final state is written back to the Markdown frontmatter.

```yaml
x: 420
y: 180
width: 320
height: 260
```

Petari stores the current state rather than the full movement history.

## Philosophy

Petari is not intended to replace tools such as Notion, Trello, or Jira.

Its goal is much simpler:

> Put what matters on the screen, see it, and edit it immediately.

Petari combines the openness of Markdown files with the immediacy of desktop sticky notes.
