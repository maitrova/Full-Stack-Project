import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export default function RichTextEditor({ value, onChange, error }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: value || "",
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-[220px] focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) editor.commands.setContent(next, false);
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previousUrl);

    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const Btn = ({ onClick, active, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-sm ${
        active ? "bg-gray-900 text-white" : "bg-white"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rounded-lg border ${error ? "border-red-500" : "border-gray-300"}`}>
      <div className="flex flex-wrap gap-2 border-b bg-gray-50 p-2">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          B
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          I
        </Btn>
        <Btn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")}>
          P
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
          H2
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
          H3
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          List
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          1. List
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          Quote
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          {"</>"}
        </Btn>
        <Btn onClick={setLink} active={editor.isActive("link")}>
          Link
        </Btn>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="rounded border bg-white px-2 py-1 text-sm"
        >
          Clear
        </button>
      </div>

      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
