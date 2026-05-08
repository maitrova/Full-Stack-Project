import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { buildImageUrl } from "../../../utils/responsiveImage.js";

const getFigureAttrs = (element) => {
  const image = element.querySelector("img");
  const link = element.querySelector("a");

  return {
    src: image?.getAttribute("src") || "",
    alt: image?.getAttribute("alt") || "",
    href: link?.getAttribute("href") || element.getAttribute("data-href") || "",
  };
};

function BlogImageBlockView({ node, selected }) {
  const src = String(node?.attrs?.src || "").trim();
  const href = String(node?.attrs?.href || "").trim();
  const alt = String(node?.attrs?.alt || "").trim();
  const resolvedSrc = buildImageUrl(src);
  console.log("[BlogImageBlockView] render", { src, href, alt, resolvedSrc, selected });

  return (
    <NodeViewWrapper
      as="figure"
      data-blog-image="true"
      data-href={href || undefined}
      className={`my-6 overflow-hidden rounded-2xl border bg-slate-50 ${
        selected ? "border-sky-400 ring-4 ring-sky-100" : "border-slate-200"
      }`}
    >
      {resolvedSrc ? (
        href ? (
          <a
            href={href}
            target={/^https?:\/\//i.test(href) ? "_blank" : undefined}
            rel={/^https?:\/\//i.test(href) ? "noreferrer" : undefined}
            className="block"
          >
            <img
              src={resolvedSrc}
              alt={alt || "Blog image"}
              className="w-full rounded-2xl object-cover"
              loading="lazy"
              draggable="false"
            />
          </a>
        ) : (
          <img
            src={resolvedSrc}
            alt={alt || "Blog image"}
            className="w-full rounded-2xl object-cover"
            loading="lazy"
            draggable="false"
          />
        )
      ) : (
        <div className="px-4 py-6 text-sm text-rose-600">Image could not be rendered.</div>
      )}
    </NodeViewWrapper>
  );
}

export default Node.create({
  name: "blogImageBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      href: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-blog-image="true"]',
        getAttrs: (element) => {
          const attrs = getFigureAttrs(element);
          console.log("[BlogImageBlock] parseHTML attrs:", attrs);
          return attrs;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, href } = HTMLAttributes;
    const resolvedSrc = buildImageUrl(src);
    const imageNode = [
      "img",
      {
        src: resolvedSrc,
        "data-src": src,
        alt: alt || "",
        class: "blog-inline-image",
        loading: "lazy",
      },
    ];

    if (href) {
      const anchorAttributes = {
        href,
        class: "blog-inline-image-link",
      };

      if (/^https?:\/\//i.test(href)) {
        anchorAttributes.target = "_blank";
        anchorAttributes.rel = "noreferrer";
      }

      return [
        "figure",
        mergeAttributes(
          {
            "data-blog-image": "true",
            "data-href": href,
            class: "blog-inline-image-figure",
          },
          HTMLAttributes
        ),
        ["a", anchorAttributes, imageNode],
      ];
    }

    return [
      "figure",
      mergeAttributes(
        {
          "data-blog-image": "true",
          class: "blog-inline-image-figure",
        },
        HTMLAttributes
      ),
      imageNode,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlogImageBlockView);
  },

  addCommands() {
    return {
      setBlogImageBlock:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: String(attributes?.src || "").trim(),
              alt: String(attributes?.alt || "").trim(),
              href: String(attributes?.href || "").trim(),
            },
          }),
    };
  },
});
