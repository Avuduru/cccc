// ============================================================
// CCCC POLISH — tweaks.jsx
// Mounts a Tweaks panel that drives the design via CSS variables.
// Loaded only in the polish prototype — does not ship to production.
// ============================================================

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variation": "a",
  "accentHue": "green",
  "borderWeight": 2,
  "density": "regular",
  "scanlines": true,
  "shadowStyle": "hard",
  "fontScale": 100,
  "frameCorners": true
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  green:  { hue: "#7cb342", soft: "rgba(124, 179, 66, 0.4)" },
  orange: { hue: "#e67e22", soft: "rgba(230, 126, 34, 0.4)" },
  yellow: { hue: "#f1c40f", soft: "rgba(241, 196, 15, 0.4)" },
  blue:   { hue: "#2980b9", soft: "rgba(41, 128, 185, 0.4)" },
  pink:   { hue: "#ec4899", soft: "rgba(236, 72, 153, 0.4)" },
  cyan:   { hue: "#06b6d4", soft: "rgba(6, 182, 212, 0.4)" },
};

const NEON_PRESETS = {
  green:  { hue: "#00ff9c", soft: "rgba(0, 255, 156, 0.4)" },
  orange: { hue: "#ffa040", soft: "rgba(255, 160, 64, 0.4)" },
  yellow: { hue: "#fff14a", soft: "rgba(255, 241, 74, 0.4)" },
  blue:   { hue: "#4dd2ff", soft: "rgba(77, 210, 255, 0.4)" },
  pink:   { hue: "#ff5cb3", soft: "rgba(255, 92, 179, 0.4)" },
  cyan:   { hue: "#5cf6ff", soft: "rgba(92, 246, 255, 0.4)" },
};

function applyTweaks(t) {
  const root = document.documentElement;
  // variation switch
  document.body.dataset.variation = t.variation;

  // accent
  const palette = t.variation === "b" ? NEON_PRESETS : ACCENT_PRESETS;
  const acc = palette[t.accentHue] || palette.green;
  root.style.setProperty("--accent", acc.hue);
  root.style.setProperty("--accent-soft", acc.soft);

  // border weight (used by --line and direct borders)
  root.style.setProperty("--tw-border", `${t.borderWeight}px`);

  // density
  const padScale = { compact: 0.78, regular: 1, comfy: 1.22 }[t.density] || 1;
  root.style.setProperty("--tw-pad-scale", padScale);

  // scanlines (variation B mostly)
  root.style.setProperty("--tw-scanlines", t.scanlines ? "1" : "0");

  // shadow style
  root.style.setProperty(
    "--tw-shadow",
    t.shadowStyle === "hard"
      ? "4px 4px 0 #000"
      : t.shadowStyle === "soft"
        ? "0 4px 14px rgba(0, 0, 0, 0.4)"
        : "none"
  );

  // font scale
  root.style.setProperty("--tw-font-scale", `${t.fontScale / 100}`);

  // frame corner brackets
  root.style.setProperty("--tw-corners", t.frameCorners ? "1" : "0");
}

function CcccTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyTweaks(t); }, [t]);

  return (
    <TweaksPanel title="Tweaks · CCCC">
      <TweakSection label="System" />
      <TweakRadio
        label="Variation"
        value={t.variation}
        options={[
          { value: "a", label: "A · Refined" },
          { value: "b", label: "B · CRT" },
        ]}
        onChange={(v) => setTweak("variation", v)}
      />
      <TweakSelect
        label="Accent hue"
        value={t.accentHue}
        options={["green", "orange", "yellow", "blue", "pink", "cyan"]}
        onChange={(v) => setTweak("accentHue", v)}
      />

      <TweakSection label="Form" />
      <TweakSlider
        label="Border weight"
        value={t.borderWeight}
        min={1}
        max={4}
        step={1}
        unit="px"
        onChange={(v) => setTweak("borderWeight", v)}
      />
      <TweakRadio
        label="Density"
        value={t.density}
        options={["compact", "regular", "comfy"]}
        onChange={(v) => setTweak("density", v)}
      />
      <TweakRadio
        label="Shadow"
        value={t.shadowStyle}
        options={["hard", "soft", "none"]}
        onChange={(v) => setTweak("shadowStyle", v)}
      />
      <TweakSlider
        label="Font scale"
        value={t.fontScale}
        min={85}
        max={120}
        step={5}
        unit="%"
        onChange={(v) => setTweak("fontScale", v)}
      />

      <TweakSection label="Effects" />
      <TweakToggle
        label="Scanlines"
        value={t.scanlines}
        onChange={(v) => setTweak("scanlines", v)}
      />
      <TweakToggle
        label="Corner brackets"
        value={t.frameCorners}
        onChange={(v) => setTweak("frameCorners", v)}
      />
    </TweaksPanel>
  );
}

const __twkRoot = document.createElement("div");
__twkRoot.id = "tweaks-root";
document.body.appendChild(__twkRoot);
ReactDOM.createRoot(__twkRoot).render(<CcccTweaks />);
