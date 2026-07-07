import React, { useMemo, useState } from "react";
import DOMPurify from "dompurify";

const plainText = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export default function ExpandableDescription({
  description,
  html = false,
  limit = 150,
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);
  const text = useMemo(() => plainText(description), [description]);
  const canExpand = text.length > limit;

  if (!text) return null;

  return (
    <div>
      {html ? (
        <div
          className={`${className} ${!expanded && canExpand ? "max-h-24 overflow-hidden" : ""}`}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
        />
      ) : (
        <p className={`${className} ${!expanded && canExpand ? "line-clamp-3" : ""}`}>{description}</p>
      )}
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex text-xs font-bold text-orange-600 transition hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
}
