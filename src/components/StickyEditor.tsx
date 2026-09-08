import { forwardRef, useImperativeHandle } from "react";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export type StickyEditorHandle = {
  toggleBold: () => void;
  toggleStrike: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
};

const StickyEditor = forwardRef<StickyEditorHandle, Props>(function StickyEditor(
  { markdown, onChange },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
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
    toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    toggleTaskList: () => editor?.chain().focus().toggleTaskList().run(),
  }));

  return (
    <section className="sticky__editor-shell">
      <EditorContent className="sticky__editor" editor={editor} />
    </section>
  );
});

export default StickyEditor;
