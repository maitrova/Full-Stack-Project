import React, { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

const ToolbarButton = ({ active = false, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex min-w-[42px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
      active
        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    }`}
  >
    {children}
  </button>
);

const normalizeEditorValue = (value) => String(value || "").trim();

export default function BlogRichTextEditor({ value, onChange, error }) {
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkEditor, setShowLinkEditor] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: value || "",
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "blog-editor prose prose-slate max-w-none min-h-[380px] px-5 py-4 text-[15px] leading-7 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const current = normalizeEditorValue(editor.getHTML());
    const next = normalizeEditorValue(value);

    if (current !== next) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, value]);

  const editorStats = useMemo(() => {
    if (!editor) {
      return { words: 0, characters: 0 };
    }

    const text = editor.getText().replace(/\s+/g, " ").trim();
    return {
      words: text ? text.split(" ").length : 0,
      characters: text.length,
    };
  }, [editor, value]);

  if (!editor) return null;

  const applyLink = () => {
    const nextUrl = linkDraft.trim();

    if (!nextUrl) {
      editor.chain().focus().unsetLink().run();
      setShowLinkEditor(false);
      setLinkDraft("");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: nextUrl }).run();
    setShowLinkEditor(false);
    setLinkDraft("");
  };

  const openLinkEditor = () => {
    setLinkDraft(editor.getAttributes("link").href || "");
    setShowLinkEditor(true);
  };

  const insertSectionTemplate = () => {
    editor
      .chain()
      .focus()
      .insertContent(
        '<h2>Section Heading</h2><p>Write the main section content here.</p><h3>Supporting Detail</h3><p>Add supporting detail for this section.</p>'
      )
      .run();
  };

  const insertFaqTemplate = () => {
    editor
      .chain()
      .focus()
      .insertContent(
        '<h2>Frequently Asked Questions</h2><h3>Question</h3><p>Answer the question clearly and directly.</p>'
      )
      .run();
  };

  return (
    <div className={`overflow-hidden rounded-[24px] border bg-white shadow-sm ${error ? "border-rose-300" : "border-slate-200"}`}>
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#f8fafc,_#f1f5f9)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
            Undo
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
            Redo
          </ToolbarButton>
          <div className="mx-1 h-8 w-px bg-slate-200" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            Bold
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            Italic
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strike"
          >
            Strike
          </ToolbarButton>
          <div className="mx-1 h-8 w-px bg-slate-200" />
          <ToolbarButton
            onClick={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive("paragraph")}
            title="Paragraph"
          >
            Paragraph
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
          <div className="mx-1 h-8 w-px bg-slate-200" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            Bullets
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            Numbers
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Quote"
          >
            Quote
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Code block"
          >
            Code
          </ToolbarButton>
          <ToolbarButton
            onClick={openLinkEditor}
            active={editor.isActive("link")}
            title="Add link"
          >
            Link
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Clear formatting"
          >
            Clear
          </ToolbarButton>
        </div>

        {showLinkEditor ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row">
            <input
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
            <button
              type="button"
              onClick={applyLink}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply Link
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLinkEditor(false);
                setLinkDraft("");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={insertSectionTemplate}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            Insert H2/H3 Section
          </button>
          <button
            type="button"
            onClick={insertFaqTemplate}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            Insert FAQ Block
          </button>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            Keep the blog title as the only H1. Use H2 and H3 inside content.
          </div>
        </div>
      </div>

      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span>{editorStats.words} words</span>
          <span>{editorStats.characters} characters</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>`Ctrl+B` bold</span>
          <span>`Ctrl+I` italic</span>
          <span>`Shift+Enter` line break</span>
        </div>
      </div>
    </div>
  );
}
