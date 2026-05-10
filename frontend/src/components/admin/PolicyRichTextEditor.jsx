import React, { useEffect, useRef } from "react";

const ToolbarButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
  >
    {label}
  </button>
);

const applyCommand = (command, value = null) => {
  document.execCommand(command, false, value);
};

const PolicyRichTextEditor = ({ value, onChange, error }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const currentHtml = editorRef.current.innerHTML;
    const nextHtml = value || "";

    if (currentHtml !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [value]);

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleCreateLink = () => {
    const url = window.prompt("Enter link URL");
    if (!url) {
      return;
    }

    applyCommand("createLink", url);
    handleInput();
  };

  const runCommand = (command, value = null) => {
    editorRef.current?.focus();
    applyCommand(command, value);
    handleInput();
  };

  return (
    <div className={`overflow-hidden rounded-2xl border ${error ? "border-red-400" : "border-gray-200"} bg-white shadow-sm`}>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-3">
        <ToolbarButton label="H1" onClick={() => runCommand("formatBlock", "<h1>")} />
        <ToolbarButton label="H2" onClick={() => runCommand("formatBlock", "<h2>")} />
        <ToolbarButton label="P" onClick={() => runCommand("formatBlock", "<p>")} />
        <ToolbarButton label="Bold" onClick={() => runCommand("bold")} />
        <ToolbarButton label="Italic" onClick={() => runCommand("italic")} />
        <ToolbarButton label="Underline" onClick={() => runCommand("underline")} />
        <ToolbarButton label="Bullet List" onClick={() => runCommand("insertUnorderedList")} />
        <ToolbarButton label="Numbered List" onClick={() => runCommand("insertOrderedList")} />
        <ToolbarButton label="Quote" onClick={() => runCommand("formatBlock", "<blockquote>")} />
        <ToolbarButton label="Link" onClick={handleCreateLink} />
        <ToolbarButton label="Clear" onClick={() => runCommand("removeFormat")} />
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[320px] w-full px-4 py-4 text-gray-800 outline-none"
        style={{ whiteSpace: "pre-wrap" }}
      />
    </div>
  );
};

export default PolicyRichTextEditor;
