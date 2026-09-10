import { invoke } from "@tauri-apps/api/core";
import { forwardRef, useImperativeHandle } from "react";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  markdown: string;
  onUpdate: () => void;
};

export type StickyEditorHandle = {
  toggleBold: () => void;
  toggleStrike: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleTaskList: () => void;
  getMarkdown: () => string;
};

const StickyEditor = forwardRef<StickyEditorHandle, Props>(function StickyEditor(
  { markdown, onUpdate },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { "data-type": "taskItem" },
      }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "sticky__editor-content",
        spellcheck: "false",
      },
      handleClick: (_view, _pos, event) => {
        if (!event.ctrlKey || !(event.target instanceof Element)) return false;
        const link = event.target.closest("a[href]");
        if (!(link instanceof HTMLAnchorElement)) return false;

        event.preventDefault();
        void invoke("open_url", { url: link.href });
        return true;
      },
    },
    onUpdate,
  });

  useImperativeHandle(ref, () => ({
    toggleBold: () => editor?.chain().focus().toggleBold().run(),
    toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
    toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    toggleTaskList: () => editor?.chain().focus().toggleTaskList().run(),
    getMarkdown: () => editor?.getMarkdown() ?? markdown,
  }));

  return (
    <section className="sticky__editor-shell">
      <EditorContent className="sticky__editor" editor={editor} />
    </section>
  );
});

export default StickyEditor;
