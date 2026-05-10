import React from "react";
import DOMPurify from "dompurify";

const sanitizeConfig = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["style", "target", "rel", "class"],
};

const PolicyContent = ({ content, className = "" }) => {
  const safeHtml = DOMPurify.sanitize(content || "", sanitizeConfig);

  return (
    <div
      className={[
        "text-gray-700 leading-7",
        "[&_h1]:mb-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-gray-950",
        "[&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900",
        "[&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900",
        "[&_p]:mb-4",
        "[&_strong]:font-semibold [&_strong]:text-gray-900",
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:mb-2",
        "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_a]:text-sky-700 [&_a]:underline",
        "[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
        "[&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2",
        className,
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};

export default PolicyContent;
