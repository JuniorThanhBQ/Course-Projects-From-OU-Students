export function createExplorationLayer(L, getThemePalette) {
  const ExplorationCanvasLayer = L.Layer.extend({
    initialize() {
      this._fwdSegments = [];
      this._bwdSegments = [];
      this._fwdTips = [];
      this._bwdTips = [];
      this._meeting = null;
      this._canvas = null;
      this._ctx = null;
      this._dpr = 1;
      this._topLeft = null;
    },

    onAdd(map) {
      this._map = map;
      const canvas = L.DomUtil.create(
        "canvas",
        "ch-canvas-layer leaflet-zoom-animated",
      );
      canvas.style.pointerEvents = "none";
      canvas.setAttribute("aria-hidden", "true");
      this._canvas = canvas;
      this._ctx = canvas.getContext("2d");

      map.getPanes().overlayPane.appendChild(canvas);

      map.on("moveend zoomend resize viewreset", this.redraw, this);
      if (map.options.zoomAnimation) {
        map.on("zoomanim", this._animateZoom, this);
      }

      this._resetSize();
      this.redraw();
    },

    onRemove(map) {
      map.off("moveend zoomend resize viewreset", this.redraw, this);
      if (map.options.zoomAnimation) {
        map.off("zoomanim", this._animateZoom, this);
      }
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      this._canvas = null;
      this._ctx = null;
      this._map = null;
    },

    _animateZoom(e) {
      if (!this._canvas || !this._map) return;
      const scale = this._map.getZoomScale(e.zoom);
      const offset = this._map
        ._getCenterOffset(e.center)
        ._multiplyBy(-scale)
        .subtract(this._map._getMapPanePos());
      L.DomUtil.setTransform(this._canvas, offset, scale);
    },

    _resetSize() {
      if (!this._map || !this._canvas || !this._ctx) return;
      const size = this._map.getSize();
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      this._topLeft = topLeft;
      L.DomUtil.setPosition(this._canvas, topLeft);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._dpr = dpr;

      const pixelW = Math.max(1, Math.round(size.x * dpr));
      const pixelH = Math.max(1, Math.round(size.y * dpr));
      if (this._canvas.width !== pixelW) this._canvas.width = pixelW;
      if (this._canvas.height !== pixelH) this._canvas.height = pixelH;

      this._canvas.style.width = `${size.x}px`;
      this._canvas.style.height = `${size.y}px`;
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._ctx.clearRect(0, 0, size.x, size.y);
    },

    _project(ll) {
      return this._map.latLngToLayerPoint(ll).subtract(this._topLeft);
    },

    _drawSegments(ctx, segments, color, dashed, alpha) {
      if (!segments.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = alpha;
      ctx.setLineDash(dashed ? [5, 4] : []);

      for (let i = 0; i < segments.length; i++) {
        const coords = segments[i];
        if (!coords || coords.length < 2) continue;
        const p0 = this._project(coords[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let j = 1; j < coords.length; j++) {
          const pj = this._project(coords[j]);
          ctx.lineTo(pj.x, pj.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    },

    _drawForwardTips(ctx, tips, color) {
      if (!tips.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;
      for (let i = 0; i < tips.length; i++) {
        const pt = this._project(tips[i]);
        ctx.moveTo(pt.x + 2.2, pt.y);
        ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    },

    _drawBackwardTips(ctx, tips, color) {
      if (!tips.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < tips.length; i++) {
        const pt = this._project(tips[i]);
        ctx.moveTo(pt.x + 2.8, pt.y);
        ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    },

    _drawMeeting(ctx, ll, palette) {
      if (!ll) return;
      const pt = this._project(ll);
      ctx.save();
      // Outer high-contrast halo
      ctx.beginPath();
      ctx.fillStyle = palette.casing;
      ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      // Meeting ring
      ctx.beginPath();
      ctx.strokeStyle = palette.meet;
      ctx.lineWidth = 2.2;
      ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      // Core dot
      ctx.beginPath();
      ctx.fillStyle = palette.meet;
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    appendBatch(segments = [], tips = []) {
      const newFwdSegs = [];
      const newBwdSegs = [];
      const newFwdTips = [];
      const newBwdTips = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.dir === 0) {
          this._fwdSegments.push(seg.coords);
          newFwdSegs.push(seg.coords);
        } else {
          this._bwdSegments.push(seg.coords);
          newBwdSegs.push(seg.coords);
        }
      }

      for (let i = 0; i < tips.length; i++) {
        const tip = tips[i];
        if (tip.dir === 0) {
          this._fwdTips.push(tip.ll);
          newFwdTips.push(tip.ll);
        } else {
          this._bwdTips.push(tip.ll);
          newBwdTips.push(tip.ll);
        }
      }

      if (!this._map || !this._ctx) return;
      const palette = getThemePalette();
      this._drawSegments(this._ctx, newFwdSegs, palette.forward, false, 0.82);
      this._drawSegments(this._ctx, newBwdSegs, palette.backward, true, 0.85);
      this._drawForwardTips(this._ctx, newFwdTips, palette.forward);
      this._drawBackwardTips(this._ctx, newBwdTips, palette.backward);
    },

    setMeeting(ll) {
      this._meeting = ll;
      if (!this._map || !this._ctx || !ll) return;
      this._drawMeeting(this._ctx, ll, getThemePalette());
    },

    redraw() {
      if (!this._map || !this._canvas || !this._ctx) return;
      this._resetSize();
      const palette = getThemePalette();
      this._drawSegments(
        this._ctx,
        this._fwdSegments,
        palette.forward,
        false,
        0.82,
      );
      this._drawSegments(
        this._ctx,
        this._bwdSegments,
        palette.backward,
        true,
        0.85,
      );
      this._drawForwardTips(this._ctx, this._fwdTips, palette.forward);
      this._drawBackwardTips(this._ctx, this._bwdTips, palette.backward);
      if (this._meeting) {
        this._drawMeeting(this._ctx, this._meeting, palette);
      }
    },

    clear() {
      this._fwdSegments = [];
      this._bwdSegments = [];
      this._fwdTips = [];
      this._bwdTips = [];
      this._meeting = null;
      if (this._map && this._ctx && this._canvas) {
        const size = this._map.getSize();
        this._ctx.clearRect(0, 0, size.x, size.y);
      }
    },
  });

  return new ExplorationCanvasLayer();
}
