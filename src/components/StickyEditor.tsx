import { forwardRef, useImperativeHandle } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export type StickyEditorHandle = {
  toggleBold: () => void;
  toggleStrike: () => void;
};

const StickyEditor = forwardRef<StickyEditorHandle, Props>(function StickyEditor(
  { markdown, onChange },
  ref,
) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "sticky__editor-content" },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });

  useImperativeHandle(ref, () => ({
    toggleBold: () => editor?.chain().focus().toggleBold().run(),
    toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
  }));

  return (
    <section className="sticky__editor-shell">
      <EditorContent className="sticky__editor" editor={editor} />
    </section>
  );
});

export default StickyEditor;
