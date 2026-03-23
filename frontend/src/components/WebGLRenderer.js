// src/WebGLRenderer.js
export class WebGLRenderer {
  constructor() {
    this.gl = null;
    this.program = null;
    this.textures = {};
    this.canvas = null;
    this.textures.designLoaded = false;
  }

  async initialize(container, mockupUrl, maskUrl, previewWidth) {
    try {
      container.innerHTML = "";
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "auto";
      this.canvas.style.height = "auto";
      this.canvas.style.maxWidth = "100%";
      this.canvas.style.maxHeight = "min(68vh, 620px)";
      container.appendChild(this.canvas);

      this.gl = this.canvas.getContext("webgl", { preserveDrawingBuffer: true });
      if (!this.gl) {
        console.warn("WebGL not available");
        return false;
      }

      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

      this.program = this.createProgram(VERTEX_SRC, FRAGMENT_SRC);
      this.setupGeometry();

      this.textures.mock = this.createTexture();
      this.textures.mask = this.createTexture();
      this.textures.design = this.createTexture();

      const [mockBmp, maskBmp] = await Promise.all([
        this.loadImageBitmapEnhanced(mockupUrl),
        this.loadImageBitmapEnhanced(maskUrl),
      ]);

      const ratio = mockBmp.width / mockBmp.height;
      const w = Math.min(previewWidth, mockBmp.width);
      const h = Math.round(w / ratio);
      this.canvas.width = w;
      this.canvas.height = h;

      const gl = this.gl;

      gl.bindTexture(gl.TEXTURE_2D, this.textures.mock);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mockBmp);

      gl.bindTexture(gl.TEXTURE_2D, this.textures.mask);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskBmp);

      this.uploadTransparentPixel(this.textures.design);

      gl.useProgram(this.program);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_mockup"), 0);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_mask"), 1);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_design"), 2);

      return true;
    } catch (err) {
      console.warn("GL init failed:", err);
      return false;
    }
  }

  render(productColor) {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.mock);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.mask);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.design);

    const pr = parseInt(productColor.slice(1, 3), 16) / 255;
    const pg = parseInt(productColor.slice(3, 5), 16) / 255;
    const pb = parseInt(productColor.slice(5, 7), 16) / 255;
    gl.uniform3f(gl.getUniformLocation(this.program, "u_color"), pr, pg, pb);

    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_hasDesign"),
      this.textures.designLoaded ? 1.0 : 0.0
    );

    const transform = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    gl.uniformMatrix3fv(
      gl.getUniformLocation(this.program, "u_designMat"),
      false,
      new Float32Array(transform)
    );

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  updateDesignTexture(canvas) {
    if (!this.gl) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.design);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    this.textures.designLoaded = true;
  }

  clearDesignTexture() {
    if (!this.gl) return;
    this.uploadTransparentPixel(this.textures.design);
    this.textures.designLoaded = false;
  }

  createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSrc);
    const pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(pr);
      gl.deleteProgram(pr);
      throw new Error("Program link error: " + info);
    }
    return pr;
  }

  createShader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader compile error: " + info);
    }
    return s;
  }

  setupGeometry() {
    const gl = this.gl;
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  createTexture() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const data = new Uint8Array([0, 0, 0, 0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  }

  uploadTransparentPixel(tex) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const data = new Uint8Array([0, 0, 0, 0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  async loadImageBitmapEnhanced(url) {
    const resp = await fetch(url, { mode: "same-origin" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} when fetching ${url}`);
    const blob = await resp.blob();
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(blob);
    }
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed: " + url));
      img.src = URL.createObjectURL(blob);
    });
  }

  cleanup() {
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
  }
}

const VERTEX_SRC = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_pos + 1.0) * 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAGMENT_SRC = `
  precision mediump float;
  varying vec2 v_uv;

  uniform sampler2D u_mockup;
  uniform sampler2D u_mask;
  uniform sampler2D u_design;
  uniform vec3 u_color;
  uniform float u_hasDesign;
  uniform mat3 u_designMat;

  void main() {
    vec4 mock = texture2D(u_mockup, v_uv);
    float mask = texture2D(u_mask, v_uv).r;

    vec3 tinted = mock.rgb * u_color;
    vec3 productRgb = mix(mock.rgb, tinted, mask);

    vec4 designColor = texture2D(u_design, v_uv);
    vec3 finalRgb = mix(productRgb, designColor.rgb, designColor.a * u_hasDesign);

    gl_FragColor = vec4(finalRgb, 1.0);
  }
`;
