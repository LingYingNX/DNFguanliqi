import { Image as ImageIcon, Plus, RotateCcw, Sun, Trash2, Type, X } from "lucide-react";
import { useEffect, useState } from "react";
import { defaultAppearanceSettings, resetWallpaperControls } from "../../core/state/schemas";
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
  defaultValue,
  label,
  testId,
  onChange,
}: {
  readonly color: string;
  readonly defaultValue: string;
  readonly label: string;
  readonly testId: string;
  readonly onChange: (color: string) => void;
}): React.JSX.Element {
  const hsv = hexToHsv(color);
  const [draftColor, setDraftColor] = useState(color);
  const [dragging, setDragging] = useState(false);
  useEffect(() => setDraftColor(color), [color]);

  const updateHue = (hue: number): void => {
    // Hue-only edits on near-white text are invisible; the bar always paints at full saturation.
    onChange(
      hsvToHex({
        ...hsv,
        hue: Math.min(360, Math.max(0, hue)),
        saturation: 100,
      }),
    );
  };

  const applyBarPoint = (event: React.PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    updateHue(((event.clientX - bounds.left) / bounds.width) * 360);
  };

  const startDragging = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    applyBarPoint(event);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDragging(false);
  };

  return (
    <div className="appearance-font-color-picker" data-testid={testId}>
      <div className="appearance-font-color-bar-row">
        <div
          aria-label={`${label}色相`}
          aria-valuemax={360}
          aria-valuemin={0}
          aria-valuenow={hsv.hue}
          className="appearance-font-color-bar"
          data-dragging={dragging}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              updateHue(hsv.hue - 5);
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              updateHue(hsv.hue + 5);
            }
          }}
          onLostPointerCapture={() => setDragging(false)}
          onPointerCancel={stopDragging}
          onPointerDown={startDragging}
          onPointerMove={(event) => {
            if (dragging) applyBarPoint(event);
          }}
          onPointerUp={stopDragging}
          role="slider"
          tabIndex={0}
        >
          <span
            aria-hidden="true"
            className="appearance-font-color-bar-marker"
            style={{ left: `${(hsv.hue / 360) * 100}%` }}
          />
        </div>
        <button
          aria-label={`重置${label}颜色`}
          className="appearance-font-color-reset"
          onClick={() => onChange(defaultValue)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 1271 1024">
            <path
              d="M871.97099 850.891158a425.966862 425.966862 0 0 1-254.114811 79.820585c-11.939526-0.157099-23.736234-1.085411-35.518662-2.013723-4.812943-0.457015-9.454505-1.228229-14.281729-1.999443-9.311688-1.228229-18.466276-2.31364-27.463766-4.284518-5.584156-0.928312-11.168312-2.613556-16.452552-3.856067-8.840391-1.999442-17.680781-4.013166-26.221255-6.626723-4.041729-1.542427-7.912078-2.856346-12.110907-4.612998-10.082901-3.241953-19.994421-6.783821-29.477489-10.782706-2.170823-0.928312-4.284519-1.856625-6.35537-2.613557-11.168312-5.241395-22.350907-10.625607-33.047922-16.338298-0.457015-0.314198-0.928312-0.457015-1.428173-0.771213a435.592748 435.592748 0 0 1-98.815286-75.493222c-0.457015-0.471297-0.928312-1.085411-1.428173-1.542427-8.99749-9.240279-17.680781-18.794756-25.907057-29.120446-1.713808-2.156541-3.256234-4.155983-5.127141-6.626723a445.761339 445.761339 0 0 1-94.944937-275.480279h105.356318l-127.378745-252.086806L0 491.748508h104.356597a536.064714 536.064714 0 0 0 92.57417 301.444463 22.565132 22.565132 0 0 0 1.98516 3.656122c5.969763 8.868954 12.853556 16.895286 19.166081 25.050154 2.55643 2.956318 4.684407 6.041172 7.240837 9.425941 9.368815 11.539637 19.73735 22.650823 29.991632 33.490656 1.142538 1.128257 1.98516 1.970879 2.856346 2.956318A522.611325 522.611325 0 0 0 375.609484 957.561395c1.128257 0.714086 2.127978 1.128257 3.399052 1.970878 12.353696 6.755258 25.135844 13.096346 37.903709 18.723348 3.270516 1.428173 6.398215 2.956318 9.511632 4.284518 11.082622 4.784379 22.436597 8.726137 33.804854 12.853557 5.398494 1.970879 10.65417 3.656123 16.181199 5.484184 9.997211 2.956318 20.165802 5.484184 30.534338 7.883515 6.812385 1.685244 13.481953 3.370488 20.437155 4.784379a60.397434 60.397434 0 0 0 8.369093 1.970879c9.797266 1.828061 19.451715 2.670683 29.106165 3.941757 3.556151 0.714086 7.140865 1.271074 10.511352 1.685244 17.466555 1.685244 34.790293 2.856346 52.256848 2.856346 106.056123 0 234.36318-33.933389 313.726751-108.84106 23.721953-22.522287 19.108954-53.370823 8.826109-64.710516-14.03894-15.709902-47.129707-21.751074-78.163906 0.599833z m294.303599-318.768201A533.951018 533.951018 0 0 0 1074.414505 231.535397c-0.856904-1.428173-1.428173-2.956318-2.127978-4.284518-7.526471-10.554198-15.19576-20.265774-23.007866-30.248703a33.590628 33.590628 0 0 1-2.556429-3.656123 524.739303 524.739303 0 0 0-195.088424-149.172664c-2.270795-0.842622-4.113138-1.970879-6.398215-2.856346-12.068061-5.070014-24.421757-9.440223-36.918271-13.79615-4.284519-1.428173-8.811827-3.099135-13.2106-4.513027-10.939805-3.370488-21.72251-6.041172-32.847977-8.726137-6.11258-1.428173-12.353696-2.956318-18.451995-4.284518-2.984881-0.571269-5.826946-1.428173-8.954644-2.113696-8.226276-1.428173-16.324017-2.113696-24.707392-3.241953-5.826946-0.714086-11.425384-1.542427-17.038103-2.113696-13.910404-1.428173-27.677992-1.970879-41.417015-2.113696-2.55643 0-4.970042-0.41417-7.526472-0.41417-0.428452 0-0.856904 0.142817-1.285356 0.142817a511.800056 511.800056 0 0 0-298.173947 96.116039c-29.47749 20.979861-25.52145 50.585886-12.339414 65.524575 9.368815 10.611325 37.960837 25.592859 61.140084 7.912078 73.279554-55.498801 162.26901-80.577517 251.78689-79.806304 12.853556 0.157099 25.707113 0.771213 38.160781 1.999442 3.88463 0.314198 7.59788 0.928312 11.425383 1.542427a303.715258 303.715258 0 0 1 30.72 4.927197c4.284519 0.771213 8.854672 1.999442 13.039219 2.856345 10.082901 2.31364 19.708787 4.62728 29.320391 7.697853a68.937908 68.937908 0 0 1 8.997489 3.22767c11.168312 3.698968 22.036709 7.555035 32.576625 12.168034 1.24251 0.314198 2.170823 1.228229 3.256234 1.542427a435.749847 435.749847 0 0 1 163.66862 125.10795 9.568759 9.568759 0 0 0 0.628396 0.928312 446.43258 446.43258 0 0 1 98.543933 280.407476H970.15788l133.648424 255.000278 166.967699-255.157378z m0 0"
              fill="currentColor"
            />
          </svg>
        </button>
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

function defaultFontColor(key: FontColorControl["key"], appearance: AppearanceSettingsDto): string {
  return appearance.theme === "high-contrast" ? "#FFFFFF" : defaultAppearanceSettings()[key];
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
                    defaultValue={defaultFontColor(control.key, props.appearance)}
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
