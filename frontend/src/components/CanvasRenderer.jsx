// src/CanvasRenderer.jsx
import React, { useEffect, useRef } from "react";
import { WebGLRenderer } from "./WebGLRenderer.js";

export default function CanvasRenderer({
  mockupUrl,
  maskUrl,
  previewWidth,
  productColor,
  onRendererReady,
  showBoundaries = false,
}) {
  const containerRef = useRef(null);
  const webglRendererRef = useRef(null);
  const boundaryCanvasRef = useRef(null);

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

  // Draw boundary guides if enabled
  useEffect(() => {
    if (!containerRef.current || !showBoundaries) return;
    
    const container = containerRef.current;
    const webglCanvas = container.querySelector('canvas');
    if (!webglCanvas) return;
    
    // Create a separate canvas for boundaries if it doesn't exist
    if (!boundaryCanvasRef.current) {
      const boundaryCanvas = document.createElement('canvas');
      boundaryCanvas.style.position = 'absolute';
      boundaryCanvas.style.top = '0';
      boundaryCanvas.style.left = '0';
      boundaryCanvas.style.pointerEvents = 'none';
      boundaryCanvas.style.zIndex = '10';
      boundaryCanvas.width = webglCanvas.width;
      boundaryCanvas.height = webglCanvas.height;
      
      container.style.position = 'relative';
      container.appendChild(boundaryCanvas);
      boundaryCanvasRef.current = boundaryCanvas;
    }
    
    const boundaryCanvas = boundaryCanvasRef.current;
    if (!boundaryCanvas) return;
    
    // Update boundary canvas size to match WebGL canvas
    boundaryCanvas.width = webglCanvas.width;
    boundaryCanvas.height = webglCanvas.height;
    
    const ctx = boundaryCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the boundary canvas
    ctx.clearRect(0, 0, boundaryCanvas.width, boundaryCanvas.height);
    
    // Draw main printable area (torso/shoulders only)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    
    // Main torso printable area (30-70% width, 25-65% height)
    const torsoArea = {
      x: boundaryCanvas.width * 0.3,
      y: boundaryCanvas.height * 0.25,
      width: boundaryCanvas.width * 0.4,
      height: boundaryCanvas.height * 0.4,
    };
    
    ctx.strokeRect(torsoArea.x, torsoArea.y, torsoArea.width, torsoArea.height);
    
    // Draw sleeve areas (smaller, separated)
    const leftSleeveArea = {
      x: boundaryCanvas.width * 0.15,
      y: boundaryCanvas.height * 0.2,
      width: boundaryCanvas.width * 0.2,
      height: boundaryCanvas.height * 0.2,
    };
    
    const rightSleeveArea = {
      x: boundaryCanvas.width * 0.65,
      y: boundaryCanvas.height * 0.2,
      width: boundaryCanvas.width * 0.2,
      height: boundaryCanvas.height * 0.2,
    };
    
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.strokeRect(leftSleeveArea.x, leftSleeveArea.y, leftSleeveArea.width, leftSleeveArea.height);
    ctx.strokeRect(rightSleeveArea.x, rightSleeveArea.y, rightSleeveArea.width, rightSleeveArea.height);
    
    // Add labels
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Torso Area', torsoArea.x + torsoArea.width/2, torsoArea.y - 5);
    
    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.fillText('Sleeve', leftSleeveArea.x + leftSleeveArea.width/2, leftSleeveArea.y - 5);
    ctx.fillText('Sleeve', rightSleeveArea.x + rightSleeveArea.width/2, rightSleeveArea.y - 5);
    
    ctx.setLineDash([]);
    
  }, [showBoundaries]);

  // Cleanup boundary canvas
  useEffect(() => {
    return () => {
      if (boundaryCanvasRef.current && boundaryCanvasRef.current.parentElement) {
        boundaryCanvasRef.current.parentElement.removeChild(boundaryCanvasRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "clamp(280px, 62vw, 400px)",
          position: "relative",
          backgroundColor: "#f8f9fa",
        }}
      />
      {showBoundaries && (
        <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-3 py-2 rounded-md shadow-lg z-20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 border-2 border-blue-500"></div>
            <span>Torso Printable Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-green-500"></div>
            <span>Sleeve Printable Area</span>
          </div>
        </div>
      )}
    </div>
  );
}

