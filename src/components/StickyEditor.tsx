import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
};

function StickyEditor({ markdown, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "sticky__editor-content" },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });

  return (
    <section className="sticky__editor-shell">
      <div className="sticky__toolbar">
        <button
          className="format-button"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            editor?.chain().focus().toggleBold().run();
          }}
        >
          <strong>B</strong>
        </button>
        <button
          className="format-button"
          type="button"
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
