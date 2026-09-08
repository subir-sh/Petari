import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

type StickyEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

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

      <EditorContent className="sticky__editor" editor={editor} />
    </section>
  );
}

export default StickyEditor;
