import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import BlogImageBlock from "./extensions/BlogImageBlock.jsx";

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

export default function BlogRichTextEditor({ value, onChange, error, onImageUpload }) {
  const [linkDraft, setLinkDraft] = useState("");
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageAltDraft, setImageAltDraft] = useState("");
  const [imageLinkDraft, setImageLinkDraft] = useState("");
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileRef = useRef(null);
  const fileInputRef = useRef(null);

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
      BlogImageBlock,
    ],
    content: value || "",
    onUpdate: ({ editor: currentEditor }) => {
      const nextHtml = currentEditor.getHTML();
      console.log("[BlogEditor] onUpdate HTML:", nextHtml);
      console.log(
        "[BlogEditor] image block count:",
        (nextHtml.match(/data-blog-image=\"true\"/g) || []).length
      );
      onChange(nextHtml);
    },
    editorProps: {
      attributes: {
        class:
          "blog-editor prose prose-slate max-w-none min-h-[380px] px-5 py-4 text-[15px] leading-7 prose-p:leading-7 prose-li:leading-7 [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-2 [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-slate-800 [&_figure[data-blog-image='true']]:my-6 [&_figure[data-blog-image='true']]:overflow-hidden [&_figure[data-blog-image='true']]:rounded-2xl [&_figure[data-blog-image='true']]:border [&_figure[data-blog-image='true']]:border-slate-200 [&_figure[data-blog-image='true']]:bg-slate-50 [&_figure[data-blog-image='true']_img]:w-full [&_figure[data-blog-image='true']_img]:rounded-2xl [&_figure[data-blog-image='true']_img]:object-cover focus:outline-none",
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

  const resetImageEditor = () => {
    setShowImageEditor(false);
    setImageAltDraft("");
    setImageLinkDraft("");
    setImageUrlDraft("");
    setImagePreviewUrl("");
    setImageError("");
    setIsUploadingImage(false);
    imageFileRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openImageEditor = () => {
    setShowImageEditor(true);
    setShowLinkEditor(false);
    setImageError("");
  };

  const handleImageFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    imageFileRef.current = nextFile;
    setImageError("");
    console.log("[BlogEditor] selected inline image file:", nextFile);

    if (nextFile) {
      setImagePreviewUrl(URL.createObjectURL(nextFile));
      if (!imageAltDraft.trim()) {
        const fileName = String(nextFile.name || "")
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim();
        setImageAltDraft(fileName);
      }
      return;
    }

    setImagePreviewUrl("");
  };

  const insertImageBlock = async () => {
    try {
      setImageError("");
      setIsUploadingImage(true);
      console.log("[BlogEditor] insertImageBlock started");

      let finalImageUrl = imageUrlDraft.trim();
      if (!finalImageUrl && imageFileRef.current && onImageUpload) {
        console.log("[BlogEditor] uploading inline image file");
        finalImageUrl = await onImageUpload(imageFileRef.current);
      }
      console.log("[BlogEditor] finalImageUrl:", finalImageUrl);

      if (!finalImageUrl) {
        throw new Error("Select an image or provide an image URL");
      }

      const safeAlt = imageAltDraft.trim() || "Blog image";
      const safeLink = imageLinkDraft.trim();
      const safeHrefAttr = safeLink ? ` data-href="${safeLink}"` : "";
      const targetAttrs = /^https?:\/\//i.test(safeLink) ? ' target="_blank" rel="noreferrer"' : "";
      const imageHtml = safeLink
        ? `<figure data-blog-image="true"${safeHrefAttr}><a href="${safeLink}"${targetAttrs}><img src="${finalImageUrl}" alt="${safeAlt}" /></a></figure><p></p>`
        : `<figure data-blog-image="true"><img src="${finalImageUrl}" alt="${safeAlt}" /></figure><p></p>`;

      console.log("[BlogEditor] inserting image HTML:", imageHtml);

      const insertResult = editor
        .chain()
        .focus()
        .insertContent(imageHtml)
        .run();
      console.log("[BlogEditor] insert result:", insertResult);
      console.log("[BlogEditor] HTML after insert:", editor.getHTML());
      resetImageEditor();
    } catch (uploadError) {
      console.error("[BlogEditor] insertImageBlock failed:", uploadError);
      setImageError(uploadError.message || "Failed to insert image");
      setIsUploadingImage(false);
    }
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
          <ToolbarButton onClick={openImageEditor} title="Upload inline image">
            Image
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

        {showImageEditor ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Upload Image
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/avif"
                  onChange={handleImageFileChange}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-700 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Or Use Image URL
                </label>
                <input
                  value={imageUrlDraft}
                  onChange={(event) => setImageUrlDraft(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Image Alt Text
                </label>
                <input
                  value={imageAltDraft}
                  onChange={(event) => setImageAltDraft(event.target.value)}
                  placeholder="Describe the image"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Click Redirect Link
                </label>
                <input
                  value={imageLinkDraft}
                  onChange={(event) => setImageLinkDraft(event.target.value)}
                  placeholder="https://example.com/product-page"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            {imagePreviewUrl ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <img src={imagePreviewUrl} alt="Inline preview" className="max-h-52 w-full object-cover" />
              </div>
            ) : null}

            {imageError ? <div className="mt-3 text-sm text-rose-600">{imageError}</div> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={insertImageBlock}
                disabled={isUploadingImage}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isUploadingImage ? "Uploading..." : "Insert Image"}
              </button>
              <button
                type="button"
                onClick={resetImageEditor}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
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
            Keep the blog title as the only H1. Use H2 and H3 inside content. Insert images directly where they should appear.
          </div>
        </div>
      </div>

      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Test tip: type a line, select it, click `H2` or `H3`, then click outside. H2 should look larger and bolder than H3 in the editor itself.
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
