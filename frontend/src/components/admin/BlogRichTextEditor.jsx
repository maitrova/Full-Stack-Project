import React, { useCallback, useMemo } from "react";
import { Editor } from "@tinymce/tinymce-react";

const TINY_API_KEY = import.meta.env.VITE_TINY_API_KEY || "";

const baseEditorStyles = `
  html, body {
    height: 100%;
  }
  body {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    color: #0f172a;
    padding: 20px;
    overflow-y: auto;
  }
  p { margin: 0 0 1rem; }
  h2 {
    margin: 2rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    font-size: 1.875rem;
    line-height: 1.2;
    font-weight: 700;
    color: #0f172a;
  }
  h3 {
    margin: 1.5rem 0 0.75rem;
    font-size: 1.5rem;
    line-height: 1.3;
    font-weight: 600;
    color: #1e293b;
  }
  blockquote {
    margin: 1.5rem 0;
    border-left: 4px solid #cbd5e1;
    padding-left: 1rem;
    color: #475569;
  }
  pre {
    margin: 1.5rem 0;
    border-radius: 16px;
    background: #0f172a;
    padding: 1rem;
    color: #f8fafc;
    overflow-x: auto;
  }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 16px;
    margin: 1.5rem 0;
  }
  figure {
    margin: 1.5rem 0;
  }
`;

export default function BlogRichTextEditor({ value, onChange, error, onImageUpload, documentBaseUrl }) {
  const supportsInlineUploads = typeof onImageUpload === "function";

  const handleEditorChange = useCallback(
    (nextValue) => {
      onChange(nextValue);
    },
    [onChange]
  );

  const handleImageUpload = useCallback(
    async (blobInfo) => {
      if (!supportsInlineUploads) {
        throw new Error("Inline image upload is not configured");
      }

      const file = blobInfo.blob();
      const uploadedUrl = await onImageUpload(file);

      if (!uploadedUrl) {
        throw new Error("Image upload returned an empty URL");
      }

      return uploadedUrl;
    },
    [onImageUpload, supportsInlineUploads]
  );

  const editorInit = useMemo(
    () => ({
      menubar: false,
      branding: false,
      height: 560,
      min_height: 560,
      max_height: 560,
      resize: true,
      plugins: [
        "anchor",
        "autolink",
        "charmap",
        "code",
        "codesample",
        "emoticons",
        "link",
        "lists",
        "searchreplace",
        "table",
        "visualblocks",
        "wordcount",
        ...(supportsInlineUploads ? ["image", "media"] : []),
      ],
      toolbar:
        `undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | link ${
          supportsInlineUploads ? "image media " : ""
        }table codesample charmap emoticons | searchreplace visualblocks code | removeformat`,
      block_formats: "Paragraph=p; Heading 2=h2; Heading 3=h3",
      style_formats: [
        { title: "Paragraph", block: "p" },
        { title: "Heading 2", block: "h2" },
        { title: "Heading 3", block: "h3" },
      ],
      content_style: baseEditorStyles,
      contextmenu: "link image table",
      paste_data_images: false,
      automatic_uploads: supportsInlineUploads,
      ...(supportsInlineUploads
        ? {
            images_upload_handler: handleImageUpload,
            image_advtab: true,
            image_caption: true,
            image_title: true,
          }
        : {}),
      link_default_target: "_blank",
      link_assume_external_targets: false,
      convert_urls: false,
      relative_urls: false,
      remove_script_host: false,
      document_base_url: documentBaseUrl,
      statusbar: true,
      rel_list: [
        { title: "No rel", value: "" },
        { title: "No opener noreferrer", value: "noopener noreferrer" },
      ],
      extended_valid_elements: "a[href|target|rel|class|title],img[src|alt|title|width|height|class],figure[class],figcaption[class]",
      setup: (editor) => {
        editor.ui.registry.addButton("sectiontemplate", {
          text: "Section",
          tooltip: "Insert H2/H3 section template",
          onAction: () => {
            editor.insertContent(
              "<h2>Section Heading</h2><p>Write the main section content here.</p><h3>Supporting Detail</h3><p>Add supporting detail for this section.</p>"
            );
          },
        });

        editor.ui.registry.addButton("faqtemplate", {
          text: "FAQ",
          tooltip: "Insert FAQ template",
          onAction: () => {
            editor.insertContent(
              "<h2>Frequently Asked Questions</h2><h3>Question</h3><p>Answer the question clearly and directly.</p>"
            );
          },
        });
      },
      toolbar_mode: "sliding",
    }),
    [handleImageUpload, supportsInlineUploads]
  );

  return (
    <div className={`overflow-hidden rounded-[24px] border bg-white shadow-sm ${error ? "border-rose-300" : "border-slate-200"}`}>
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#f8fafc,_#f1f5f9)] px-4 py-3 text-xs text-slate-500">
        {supportsInlineUploads
          ? "Keep the blog title as the only H1. Use H2 and H3 inside content. Upload inline images directly from the TinyMCE toolbar."
          : "Use H2 and H3 for structure. This editor stores formatted product descriptions with the same TinyMCE experience used in blogs."}
      </div>
      <Editor
        apiKey={TINY_API_KEY}
        value={value || ""}
        onEditorChange={handleEditorChange}
        init={{
          ...editorInit,
          toolbar: `undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | link ${
            supportsInlineUploads ? "image media " : ""
          }table codesample charmap emoticons | sectiontemplate faqtemplate | searchreplace visualblocks code | removeformat`,
        }}
      />
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        If the editor does not load, confirm `TINY_API_KEY` is present in `frontend/.env` and restart the Vite dev server so the env value is rebuilt into the client bundle.
      </div>
    </div>
  );
}
