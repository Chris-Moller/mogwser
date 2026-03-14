/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * MogwserGradientPicker — HSL color wheel, gradient picker, and color
 * harmony utilities for the Mogwser theme engine.
 */

// ---------------------------------------------------------------------------
// Color conversion utilities
// ---------------------------------------------------------------------------

/**
 * Convert HSL to RGB.
 * @param {number} h - Hue [0, 360)
 * @param {number} s - Saturation [0, 100]
 * @param {number} l - Lightness [0, 100]
 * @returns {{ r: number, g: number, b: number }} RGB values [0, 255]
 */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1, g1, b1;
  if (h < 60) {
    [r1, g1, b1] = [c, x, 0];
  } else if (h < 120) {
    [r1, g1, b1] = [x, c, 0];
  } else if (h < 180) {
    [r1, g1, b1] = [0, c, x];
  } else if (h < 240) {
    [r1, g1, b1] = [0, x, c];
  } else if (h < 300) {
    [r1, g1, b1] = [x, 0, c];
  } else {
    [r1, g1, b1] = [c, 0, x];
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Convert RGB to HSL.
 * @param {number} r - Red [0, 255]
 * @param {number} g - Green [0, 255]
 * @param {number} b - Blue [0, 255]
 * @returns {{ h: number, s: number, l: number }} HSL values (h [0,360), s/l [0,100])
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  if (d === 0) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert an HSL object to a CSS hsl() string.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {string}
 */
function hslToString({ h, s, l }) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Convert an HSL object to a hex color string.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {string} e.g. "#4a90d9"
 */
function hslToHex({ h, s, l }) {
  const { r, g, b } = hslToRgb(h, s, l);
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// Color harmony algorithms
// ---------------------------------------------------------------------------

/**
 * Complementary: hue + 180.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function complementary(hsl) {
  return [{ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }];
}

/**
 * Analogous: hue +/- 30.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function analogous(hsl) {
  return [
    { h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Triadic: hue + 120, + 240.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function triadic(hsl) {
  return [
    { h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Split-complementary: hue + 150, + 210.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function splitComplementary(hsl) {
  return [
    { h: (hsl.h + 150) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 210) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Tetradic (rectangle): hue + 90, + 180, + 270.
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function tetradic(hsl) {
  return [
    { h: (hsl.h + 90) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 270) % 360, s: hsl.s, l: hsl.l },
  ];
}

// ---------------------------------------------------------------------------
// Gradient string builder
// ---------------------------------------------------------------------------

/**
 * Build a CSS linear-gradient string from a gradient descriptor.
 * @param {{ angle: number, stops: Array<{ color: { h, s, l }, position: number }> }} gradient
 * @returns {string}
 */
function buildGradientString(gradient) {
  if (!gradient || !gradient.stops || gradient.stops.length === 0) {
    return "none";
  }
  const stops = gradient.stops
    .map((stop) => `${hslToString(stop.color)} ${stop.position}%`)
    .join(", ");
  return `linear-gradient(${gradient.angle}deg, ${stops})`;
}

// ---------------------------------------------------------------------------
// MogwserGradientPicker class
// ---------------------------------------------------------------------------

export class MogwserGradientPicker {
  _container = null;
  _canvas = null;
  _ctx = null;
  _selectedHue = 0;
  _selectedSaturation = 100;
  _selectedLightness = 50;
  _gradient = null;
  _onChangeCallback = null;

  /**
   * Create a gradient picker.
   * @param {{ onChange: function }} options
   */
  constructor(options = {}) {
    this._onChangeCallback = options.onChange || null;
    this._gradient = {
      angle: 135,
      stops: [
        { color: { h: 0, s: 100, l: 50 }, position: 0 },
        { color: { h: 240, s: 100, l: 50 }, position: 100 },
      ],
    };
  }

  /**
   * Get the current selected HSL color.
   */
  get selectedColor() {
    return {
      h: this._selectedHue,
      s: this._selectedSaturation,
      l: this._selectedLightness,
    };
  }

  /**
   * Get the current gradient descriptor.
   */
  get gradientDescriptor() {
    return this._gradient;
  }

  /**
   * Get the CSS gradient string for the current gradient.
   */
  get gradientCSS() {
    return buildGradientString(this._gradient);
  }

  /**
   * Draw an HSL color wheel on a canvas element.
   * @param {HTMLCanvasElement} canvas
   */
  _renderColorWheel(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 4;

    ctx.clearRect(0, 0, width, height);

    // Draw the hue ring
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle = ((angle + 1) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      const { r, g, b } = hslToRgb(angle, this._selectedSaturation, this._selectedLightness);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();
    }

    // Cut out the inner circle to make it a ring
    const innerRadius = radius * 0.6;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Draw a saturation/lightness gradient in the center
    const gradSize = innerRadius * 0.85;
    const imageData = ctx.createImageData(gradSize * 2, gradSize * 2);
    for (let y = 0; y < gradSize * 2; y++) {
      for (let x = 0; x < gradSize * 2; x++) {
        const sat = (x / (gradSize * 2)) * 100;
        const lit = 100 - (y / (gradSize * 2)) * 100;
        const { r, g, b } = hslToRgb(this._selectedHue, sat, lit);
        const idx = (y * gradSize * 2 + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, cx - gradSize, cy - gradSize);

    // Draw selection indicator on the hue ring
    const selAngle = (this._selectedHue * Math.PI) / 180;
    const dotRadius = (radius + innerRadius) / 2;
    const dotX = cx + Math.cos(selAngle) * dotRadius;
    const dotY = cy + Math.sin(selAngle) * dotRadius;

    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = hslToString(this.selectedColor);
    ctx.fill();
  }

  /**
   * Build the gradient picker UI inside a container element.
   * @param {HTMLElement} container
   */
  _createPickerUI(container) {
    this._container = container;
    container.classList.add("mogwser-gradient-picker");

    // Color wheel canvas
    const wheelSection = document.createElement("div");
    wheelSection.className = "mogwser-gradient-picker__wheel-section";

    this._canvas = document.createElement("canvas");
    this._canvas.className = "mogwser-gradient-picker__canvas";
    this._canvas.width = 200;
    this._canvas.height = 200;
    wheelSection.appendChild(this._canvas);

    // Lightness slider
    const lightnessRow = document.createElement("div");
    lightnessRow.className = "mogwser-gradient-picker__slider-row";

    const lightnessLabel = document.createElement("label");
    lightnessLabel.className = "mogwser-gradient-picker__label";
    lightnessLabel.textContent = "Lightness";

    const lightnessSlider = document.createElement("input");
    lightnessSlider.type = "range";
    lightnessSlider.className = "mogwser-gradient-picker__slider";
    lightnessSlider.min = "0";
    lightnessSlider.max = "100";
    lightnessSlider.value = String(this._selectedLightness);

    lightnessSlider.addEventListener("input", () => {
      this._selectedLightness = parseInt(lightnessSlider.value, 10);
      this._renderColorWheel(this._canvas);
      this._updateGradientPreview();
      this._notifyChange();
    });

    lightnessRow.appendChild(lightnessLabel);
    lightnessRow.appendChild(lightnessSlider);

    // Saturation slider
    const satRow = document.createElement("div");
    satRow.className = "mogwser-gradient-picker__slider-row";

    const satLabel = document.createElement("label");
    satLabel.className = "mogwser-gradient-picker__label";
    satLabel.textContent = "Saturation";

    const satSlider = document.createElement("input");
    satSlider.type = "range";
    satSlider.className = "mogwser-gradient-picker__slider";
    satSlider.min = "0";
    satSlider.max = "100";
    satSlider.value = String(this._selectedSaturation);

    satSlider.addEventListener("input", () => {
      this._selectedSaturation = parseInt(satSlider.value, 10);
      this._renderColorWheel(this._canvas);
      this._updateGradientPreview();
      this._notifyChange();
    });

    satRow.appendChild(satLabel);
    satRow.appendChild(satSlider);

    // Angle slider
    const angleRow = document.createElement("div");
    angleRow.className = "mogwser-gradient-picker__slider-row";

    const angleLabel = document.createElement("label");
    angleLabel.className = "mogwser-gradient-picker__label";
    angleLabel.textContent = "Gradient Angle";

    const angleSlider = document.createElement("input");
    angleSlider.type = "range";
    angleSlider.className = "mogwser-gradient-picker__slider";
    angleSlider.min = "0";
    angleSlider.max = "360";
    angleSlider.value = String(this._gradient.angle);

    angleSlider.addEventListener("input", () => {
      this._gradient.angle = parseInt(angleSlider.value, 10);
      this._updateGradientPreview();
      this._notifyChange();
    });

    angleRow.appendChild(angleLabel);
    angleRow.appendChild(angleSlider);

    // Gradient preview
    const previewSection = document.createElement("div");
    previewSection.className = "mogwser-gradient-picker__preview-section";

    const previewBar = document.createElement("div");
    previewBar.className = "mogwser-gradient-picker__preview";
    this._previewEl = previewBar;

    // Gradient stop handles
    const stopsRow = document.createElement("div");
    stopsRow.className = "mogwser-gradient-picker__stops";

    this._gradient.stops.forEach((stop, idx) => {
      const handle = document.createElement("button");
      handle.className = "mogwser-gradient-picker__stop-handle";
      handle.style.backgroundColor = hslToString(stop.color);
      handle.style.left = `${stop.position}%`;
      handle.title = `Stop ${idx + 1}`;
      handle.dataset.index = String(idx);
      handle.addEventListener("click", () => {
        // Set the color wheel to this stop's color
        this._selectedHue = stop.color.h;
        this._selectedSaturation = stop.color.s;
        this._selectedLightness = stop.color.l;
        this._activeStopIndex = idx;
        lightnessSlider.value = String(stop.color.l);
        satSlider.value = String(stop.color.s);
        this._renderColorWheel(this._canvas);
      });
      stopsRow.appendChild(handle);
    });

    previewSection.appendChild(previewBar);
    previewSection.appendChild(stopsRow);

    // Harmony buttons
    const harmonySection = document.createElement("div");
    harmonySection.className = "mogwser-gradient-picker__harmony-section";

    const harmonyLabel = document.createElement("span");
    harmonyLabel.className = "mogwser-gradient-picker__label";
    harmonyLabel.textContent = "Color Harmony";
    harmonySection.appendChild(harmonyLabel);

    const harmonies = [
      { name: "Complementary", fn: complementary },
      { name: "Analogous", fn: analogous },
      { name: "Triadic", fn: triadic },
      { name: "Split Comp.", fn: splitComplementary },
      { name: "Tetradic", fn: tetradic },
    ];

    for (const harmony of harmonies) {
      const btn = document.createElement("button");
      btn.className = "mogwser-gradient-picker__harmony-btn";
      btn.textContent = harmony.name;
      btn.addEventListener("click", () => {
        const colors = harmony.fn(this.selectedColor);
        // Build gradient stops from primary + harmony colors
        const allColors = [this.selectedColor, ...colors];
        this._gradient.stops = allColors.map((color, i) => ({
          color: { ...color },
          position: Math.round((i / (allColors.length - 1)) * 100),
        }));
        this._updateGradientPreview();
        this._rebuildStopHandles(stopsRow, lightnessSlider, satSlider);
        this._notifyChange();
      });
      harmonySection.appendChild(btn);
    }

    // Canvas click handler — pick hue from the ring
    this._canvas.addEventListener("click", (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - this._canvas.width / 2;
      const y = e.clientY - rect.top - this._canvas.height / 2;
      const angle = (Math.atan2(y, x) * 180) / Math.PI;
      this._selectedHue = ((angle % 360) + 360) % 360;
      this._renderColorWheel(this._canvas);
      // Update the active gradient stop if one is selected
      if (this._activeStopIndex != null && this._gradient.stops[this._activeStopIndex]) {
        this._gradient.stops[this._activeStopIndex].color = { ...this.selectedColor };
        this._updateGradientPreview();
        this._rebuildStopHandles(stopsRow, lightnessSlider, satSlider);
      }
      this._notifyChange();
    });

    // Assemble
    container.appendChild(wheelSection);
    container.appendChild(lightnessRow);
    container.appendChild(satRow);
    container.appendChild(angleRow);
    container.appendChild(previewSection);
    container.appendChild(harmonySection);

    // Initial render
    this._renderColorWheel(this._canvas);
    this._updateGradientPreview();
  }

  /**
   * Update the gradient preview bar.
   */
  _updateGradientPreview() {
    if (this._previewEl) {
      this._previewEl.style.background = this.gradientCSS;
    }
  }

  /**
   * Rebuild gradient stop handle buttons.
   */
  _rebuildStopHandles(stopsContainer, lightnessSlider, satSlider) {
    stopsContainer.innerHTML = "";
    this._gradient.stops.forEach((stop, idx) => {
      const handle = document.createElement("button");
      handle.className = "mogwser-gradient-picker__stop-handle";
      handle.style.backgroundColor = hslToString(stop.color);
      handle.style.left = `${stop.position}%`;
      handle.title = `Stop ${idx + 1}`;
      handle.dataset.index = String(idx);
      handle.addEventListener("click", () => {
        this._selectedHue = stop.color.h;
        this._selectedSaturation = stop.color.s;
        this._selectedLightness = stop.color.l;
        this._activeStopIndex = idx;
        lightnessSlider.value = String(stop.color.l);
        satSlider.value = String(stop.color.s);
        this._renderColorWheel(this._canvas);
      });
      stopsContainer.appendChild(handle);
    });
  }

  /**
   * Notify the onChange callback.
   */
  _notifyChange() {
    if (typeof this._onChangeCallback === "function") {
      this._onChangeCallback({
        color: this.selectedColor,
        gradient: this._gradient,
        gradientCSS: this.gradientCSS,
      });
    }
  }
}

// Re-export utilities for external use
MogwserGradientPicker.hslToRgb = hslToRgb;
MogwserGradientPicker.rgbToHsl = rgbToHsl;
MogwserGradientPicker.hslToString = hslToString;
MogwserGradientPicker.hslToHex = hslToHex;
MogwserGradientPicker.complementary = complementary;
MogwserGradientPicker.analogous = analogous;
MogwserGradientPicker.triadic = triadic;
MogwserGradientPicker.splitComplementary = splitComplementary;
MogwserGradientPicker.tetradic = tetradic;
MogwserGradientPicker.buildGradientString = buildGradientString;
