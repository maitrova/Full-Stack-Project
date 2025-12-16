// src/CanvasRenderer.jsx
import React, { useEffect, useRef } from "react";
import { WebGLRenderer } from "./WebGLRenderer.js";

export default function CanvasRenderer({
  mockupUrl,
  maskUrl,
  previewWidth,
  productColor,
  onRendererReady, // NEW
}) {
  const containerRef = useRef(null);
  const webglRendererRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!containerRef.current) return;

      const renderer = new WebGLRenderer();
      const ok = await renderer.initialize(
        containerRef.current,
        mockupUrl,
        maskUrl,
        previewWidth
      );

      if (!ok || !mounted) return;

      webglRendererRef.current = renderer;
      renderer.render(productColor);

      if (onRendererReady) {
        onRendererReady(renderer);
      }
    }

    init();

    return () => {
      mounted = false;
      webglRendererRef.current?.cleanup();
      webglRendererRef.current = null;

      if (onRendererReady) {
        onRendererReady(null);
      }
    };
  }, [mockupUrl, maskUrl, previewWidth, productColor, onRendererReady]);

  useEffect(() => {
    if (webglRendererRef.current) {
      webglRendererRef.current.render(productColor);
    }
  }, [productColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 400,
        position: "relative",
        backgroundColor: "#f8f9fa",
      }}
    />
  );
}
