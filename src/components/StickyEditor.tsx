import { useEffect, type ClipboardEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

type StickyEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

function preserveRichText(event: ClipboardEvent<HTMLDivElement>) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  if (!event.currentTarget.contains(range.commonAncestorContainer)) return;

  const container = document.createElement("div");
  container.appendChild(range.cloneContents());

  event.clipboardData.setData("text/plain", selection.toString());
  event.clipboardData.setData("text/html", container.innerHTML);
  event.preventDefault();
}

function StickyEditor({ markdown, onChange }: StickyEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "sticky__editor-content",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = editor.getMarkdown();
    if (currentMarkdown === markdown) return;

    editor.commands.setContent(markdown, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, markdown]);

  return (
    <section className="sticky__editor-shell">
      <div className="sticky__toolbar" aria-label="Formatting">
        <button
          className={`format-button ${editor?.isActive("bold") ? "is-active" : ""}`}
          type="button"
          aria-label="Bold"
          aria-pressed={editor?.isActive("bold") ?? false}
          onMouseDown={(event) => {
            event.preventDefault();
            editor?.chain().focus().toggleBold().run();
          }}
        >
          <strong>B</strong>
        </button>
        <button
          className={`format-button ${editor?.isActive("strike") ? "is-active" : ""}`}
          type="button"
          aria-label="Strikethrough"
          aria-pressed={editor?.isActive("strike") ?? false}
          onMouseDown={(event) => {
            event.preventDefault();
            editor?.chain().focus().toggleStrike().run();
          }}
        >
          <s>S</s>
        </button>
      </div>

      <div className="sticky__editor" onCopy={preserveRichText}>
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}

export default StickyEditor;
