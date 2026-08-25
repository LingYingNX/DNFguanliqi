import { Image as ImageIcon, Plus, RotateCcw, Sun, Trash2, Type, X } from "lucide-react";
import { useEffect, useState } from "react";
import { resetWallpaperControls } from "../../core/state/schemas";
import type { AppearanceSettingsDto, WallpaperSlot } from "../../shared/appearance-contracts";
import { Dialog } from "./Dialog";

type Props = {
  readonly appearance: AppearanceSettingsDto;
  readonly busy: boolean;
  readonly onActivateWallpaper: (slot: WallpaperSlot) => void;
  readonly onClose: () => void;
  readonly onDeleteWallpaper: (slot: WallpaperSlot) => void;
  readonly onImportWallpaper: (slot: WallpaperSlot) => void;
  readonly onUpdate: (appearance: AppearanceSettingsDto) => void;
  readonly wallpaper: {
    readonly slots: readonly (string | null)[];
    readonly activeSlot: WallpaperSlot | null;
  };
};

type AppearanceTab = "theme" | "wallpaper" | "font";

type NumericControlKey =
  | "temperature"
  | "saturation"
  | "contrast"
  | "scale"
  | "opacity"
  | "blur"
  | "positionX"
  | "positionY";

type NumericControl = {
  readonly key: NumericControlKey;
  readonly label: string;
  readonly fromAppearance: (appearance: AppearanceSettingsDto) => number;
  readonly toAppearance: (value: number) => number;
};

const clamp = (value: number): number => Math.min(100, Math.max(0, value));
const round = (value: number): number => Math.round(value);

const NUMERIC_CONTROLS: readonly NumericControl[] = [
  {
    key: "temperature",
    label: "色温",
    fromAppearance: (appearance) => round((appearance.temperature + 100) / 2),
    toAppearance: (value) => value * 2 - 100,
  },
  {
    key: "saturation",
    label: "饱和度",
    fromAppearance: (appearance) => round(appearance.saturation / 2),
    toAppearance: (value) => value * 2,
  },
  {
    key: "contrast",
    label: "对比度",
    fromAppearance: (appearance) => round(appearance.contrast / 2),
    toAppearance: (value) => value * 2,
  },
  {
    key: "scale",
    label: "缩放",
    fromAppearance: (appearance) => round(appearance.scale - 50),
    toAppearance: (value) => value + 50,
  },
  {
    key: "opacity",
    label: "透明度",
    fromAppearance: (appearance) => appearance.opacity,
    toAppearance: (value) => value,
  },
  {
    key: "blur",
    label: "模糊度",
    fromAppearance: (appearance) => round(appearance.blur / 0.4),
    toAppearance: (value) => round(value * 0.4),
  },
  {
    key: "positionX",
    label: "左右移动",
    fromAppearance: (appearance) => appearance.positionX,
    toAppearance: (value) => value,
  },
  {
    key: "positionY",
    label: "上下移动",
    fromAppearance: (appearance) => appearance.positionY,
    toAppearance: (value) => value,
  },
];

const WALLPAPER_SLOTS: readonly WallpaperSlot[] = [0, 1, 2, 3, 4];

type HsvColor = {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
};

type FontColorControl = {
  readonly fieldLabel: string;
  readonly key: "navigationFontColor" | "patchCardFontColor";
  readonly label: string;
  readonly testId: string;
};

const FONT_COLOR_CONTROLS: readonly FontColorControl[] = [
  {
    fieldLabel: "导航栏颜色",
    key: "navigationFontColor",
    label: "导航栏",
    testId: "navigation-font-color-picker",
  },
  {
    fieldLabel: "补丁卡片颜色",
    key: "patchCardFontColor",
    label: "补丁卡片",
    testId: "patch-card-font-color-picker",
  },
];

function hexToHsv(hex: string): HsvColor {
  const numeric = Number.parseInt(hex.slice(1), 16);
  const red = ((numeric >> 16) & 255) / 255;
  const green = ((numeric >> 8) & 255) / 255;
  const blue = (numeric & 255) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const hue =
    delta === 0
      ? 0
      : Math.round(
          60 *
            (maximum === red
              ? ((green - blue) / delta + 6) % 6
              : maximum === green
                ? (blue - red) / delta + 2
                : (red - green) / delta + 4),
        );
  return {
    hue,
    saturation: maximum === 0 ? 0 : Math.round((delta / maximum) * 100),
    value: Math.round(maximum * 100),
  };
}

function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const chroma = (value / 100) * (saturation / 100);
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = value / 100 - chroma;
  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
}

function FontColorPicker({
  color,
  label,
  testId,
  onChange,
}: {
  readonly color: string;
  readonly label: string;
  readonly testId: string;
  readonly onChange: (color: string) => void;
}): React.JSX.Element {
  const hsv = hexToHsv(color);
  const [draftColor, setDraftColor] = useState(color);
  useEffect(() => setDraftColor(color), [color]);

  const updateHue = (hue: number): void => {
    onChange(hsvToHex({ ...hsv, hue: Math.min(360, Math.max(0, hue)) }));
  };

  const applyBarPoint = (event: React.PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    updateHue(((event.clientX - bounds.left) / bounds.width) * 360);
  };

  return (
    <div className="appearance-font-color-picker" data-testid={testId}>
      <div
        aria-label={`${label}色相`}
        aria-valuemax={360}
        aria-valuemin={0}
        aria-valuenow={hsv.hue}
        className="appearance-font-color-bar"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            updateHue(hsv.hue - 5);
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            updateHue(hsv.hue + 5);
          }
        }}
        onPointerDown={applyBarPoint}
        onPointerMove={(event) => {
          if (event.buttons !== 0) applyBarPoint(event);
        }}
        role="slider"
        tabIndex={0}
      >
        <span
          aria-hidden="true"
          className="appearance-font-color-bar-marker"
          style={{ left: `${(hsv.hue / 360) * 100}%` }}
        />
      </div>
      <div className="appearance-font-color-value">
        <span
          aria-hidden="true"
          className="appearance-font-color-swatch"
          style={{ background: color }}
        />
        <input
          aria-label={`${label}颜色`}
          maxLength={7}
          onChange={(event) => {
            const next = event.currentTarget.value.toUpperCase();
            setDraftColor(next);
            if (/^#[A-F0-9]{6}$/u.test(next)) onChange(next);
          }}
          onBlur={() => {
            if (!/^#[A-F0-9]{6}$/u.test(draftColor)) setDraftColor(color);
          }}
          spellCheck={false}
          type="text"
          value={draftColor}
        />
      </div>
    </div>
  );
}

const THEME_OPTIONS: readonly {
  readonly label: string;
  readonly previewClassName: string;
  readonly value: AppearanceSettingsDto["theme"];
}[] = [
  { label: "默认界面", previewClassName: "preview-halo", value: "halo" },
  { label: "透明玻璃", previewClassName: "preview-glass", value: "glass" },
  { label: "高对比度", previewClassName: "preview-high-contrast", value: "high-contrast" },
];

function WallpaperItem({
  busy,
  onActivate,
  onDelete,
  onImport,
  slot,
  wallpaper,
}: {
  readonly busy: boolean;
  readonly onActivate: (slot: WallpaperSlot) => void;
  readonly onDelete: (slot: WallpaperSlot) => void;
  readonly onImport: (slot: WallpaperSlot) => void;
  readonly slot: WallpaperSlot;
  readonly wallpaper: {
    readonly slots: readonly (string | null)[];
    readonly activeSlot: WallpaperSlot | null;
  };
}): React.JSX.Element {
  const assetName = wallpaper.slots[slot] ?? null;
  const active = wallpaper.activeSlot === slot;

  return (
    <div className="appearance-wallpaper-item" data-active={active} data-slot={slot}>
      <button
        aria-label={assetName === null ? `选择壁纸 ${slot + 1}` : `壁纸 ${slot + 1}`}
        className="appearance-wallpaper-select"
        disabled={busy}
        onClick={() => (assetName === null ? onImport(slot) : onActivate(slot))}
        type="button"
      >
        {assetName === null ? (
          <span
            aria-hidden="true"
            className="appearance-wallpaper-placeholder"
            data-testid="wallpaper-placeholder"
          >
            <Plus size={20} />
          </span>
        ) : (
          <img alt={`壁纸 ${slot + 1}`} src={`dnf-asset://wallpaper/${assetName}`} />
        )}
      </button>
      {assetName === null ? null : (
        <div className="appearance-wallpaper-actions">
          <button
            aria-label={`删除壁纸 ${slot + 1}`}
            className="icon-button compact appearance-wallpaper-delete"
            disabled={busy}
            onClick={() => onDelete(slot)}
            type="button"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function AppearanceCloseButton({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  return (
    <button
      aria-label="关闭对话框"
      className="dialog-close appearance-dialog-close"
      onClick={onClose}
      type="button"
    >
      <X size={16} />
    </button>
  );
}

export function AppearanceDialog(props: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppearanceTab>("wallpaper");

  const restoreDefaultWallpaperControls = (): void => {
    props.onUpdate(resetWallpaperControls(props.appearance));
  };

  const updateNumericControl = (control: NumericControl, value: number): void => {
    const normalized = clamp(value);
    props.onUpdate({
      ...props.appearance,
      [control.key]: control.toAppearance(normalized),
    });
  };

  const wheelNumericControl = (
    event: React.WheelEvent<HTMLInputElement>,
    control: NumericControl,
  ): void => {
    event.preventDefault();
    const current = control.fromAppearance(props.appearance);
    const delta = event.deltaY < 0 ? 2 : -2;
    updateNumericControl(control, current + delta);
  };

  return (
    <Dialog
      backdropClassName="appearance-dialog-backdrop"
      className="appearance-dialog-panel"
      closeOnBackdrop
      hideHeader
      onClose={props.onClose}
      title="调整外观"
    >
      <div className="appearance-dialog-body">
        <nav aria-label="外观设置导航" className="appearance-nav">
          <button
            aria-pressed={activeTab === "theme"}
            className="appearance-nav-button"
            onClick={() => setActiveTab("theme")}
            type="button"
          >
            <Sun size={14} />
            外观主题
          </button>
          <button
            aria-pressed={activeTab === "wallpaper"}
            className="appearance-nav-button"
            data-dialog-initial-focus
            onClick={() => setActiveTab("wallpaper")}
            type="button"
          >
            <ImageIcon size={14} />
            静态壁纸
          </button>
          <button
            aria-pressed={activeTab === "font"}
            className="appearance-nav-button"
            onClick={() => setActiveTab("font")}
            type="button"
          >
            <Type size={14} />
            字体外观
          </button>
        </nav>

        {activeTab === "theme" ? (
          <section aria-label="外观主题" className="appearance-panel appearance-theme-panel">
            <div className="appearance-theme-toolbar">
              <AppearanceCloseButton onClose={props.onClose} />
            </div>
            <div className="appearance-theme-grid">
              {THEME_OPTIONS.map((theme) => (
                <button
                  aria-pressed={props.appearance.theme === theme.value}
                  className="appearance-theme-card"
                  data-active={props.appearance.theme === theme.value}
                  key={theme.value}
                  onClick={() => props.onUpdate({ ...props.appearance, theme: theme.value })}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`appearance-theme-thumb ${theme.previewClassName}`}
                  >
                    <span className="appearance-theme-mini-header" />
                    <span className="appearance-theme-mini-body">
                      <span className="appearance-theme-mini-sidebar" />
                      <span className="appearance-theme-mini-content" />
                    </span>
                  </span>
                  <span className="appearance-theme-name">{theme.label}</span>
                </button>
              ))}
            </div>
          </section>
        ) : activeTab === "font" ? (
          <section aria-label="字体外观" className="appearance-panel appearance-font-panel">
            <div className="appearance-font-toolbar">
              <AppearanceCloseButton onClose={props.onClose} />
            </div>
            <div className="appearance-font-colors">
              {FONT_COLOR_CONTROLS.map((control) => (
                <section
                  aria-label={control.fieldLabel}
                  className="appearance-font-field"
                  key={control.key}
                >
                  <span>{control.fieldLabel}</span>
                  <FontColorPicker
                    color={props.appearance[control.key]}
                    label={control.label}
                    onChange={(color) =>
                      props.onUpdate({ ...props.appearance, [control.key]: color })
                    }
                    testId={control.testId}
                  />
                </section>
              ))}
            </div>
          </section>
        ) : (
          <section aria-labelledby="appearance-wallpaper-title" className="appearance-panel">
            <div className="appearance-wallpaper-layout">
              <div className="appearance-wallpaper-slots">
                {WALLPAPER_SLOTS.map((slot) => (
                  <WallpaperItem
                    busy={props.busy}
                    key={slot}
                    onActivate={props.onActivateWallpaper}
                    onDelete={props.onDeleteWallpaper}
                    onImport={props.onImportWallpaper}
                    slot={slot}
                    wallpaper={props.wallpaper}
                  />
                ))}
              </div>

              <section className="appearance-adjust-panel">
                <header className="appearance-panel-header">
                  <h3 id="appearance-wallpaper-title">壁纸微调参数</h3>
                  <div className="appearance-panel-header-actions">
                    <button
                      className="appearance-reset-button"
                      onClick={restoreDefaultWallpaperControls}
                      title="恢复默认"
                      type="button"
                    >
                      <RotateCcw size={11} />
                      恢复默认
                    </button>
                    <AppearanceCloseButton onClose={props.onClose} />
                  </div>
                </header>
                <div className="appearance-controls-list">
                  {NUMERIC_CONTROLS.map((control) => (
                    <label className="appearance-control-row" key={control.key}>
                      <span>{control.label}</span>
                      <input
                        max={100}
                        min={0}
                        onChange={(event) =>
                          updateNumericControl(control, Number(event.currentTarget.value))
                        }
                        onWheel={(event) => wheelNumericControl(event, control)}
                        type="range"
                        value={control.fromAppearance(props.appearance)}
                      />
                      <output>{control.fromAppearance(props.appearance)}</output>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}
