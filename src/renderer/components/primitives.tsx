import { AlertCircle, AlertTriangle, Check, Info, LoaderCircle, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type CommandButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type CommandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly icon?: ReactNode;
  readonly loading?: boolean;
  readonly variant?: CommandButtonVariant;
};

export function CommandButton({
  children,
  className = "",
  disabled,
  icon,
  loading = false,
  variant = "secondary",
  ...props
}: CommandButtonProps): React.JSX.Element {
  return (
    <button
      className={`command-button command-button-${variant} ${className}`.trim()}
      disabled={disabled || loading}
      type="button"
      {...props}
    >
      {loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

type SegmentOption<T extends string> = {
  readonly label: string;
  readonly value: T;
};

type SegmentedControlProps<T extends string> = {
  readonly ariaLabel: string;
  readonly onChange: (value: T) => void;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <fieldset className="segmented-control">
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export type StatusTone = "success" | "warning" | "info" | "error" | "neutral";

type StatusBadgeProps = {
  readonly children: ReactNode;
  readonly tone?: StatusTone;
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps): React.JSX.Element {
  return (
    <span className="status-badge" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

type ToastProps = {
  readonly children: ReactNode;
  /** true 时进入淡出过渡，动画结束后由宿主卸载。 */
  readonly dataLeaving?: boolean;
  readonly onClose?: () => void;
  readonly tone: Exclude<StatusTone, "neutral">;
};

const TOAST_ICONS = {
  success: Check,
  warning: AlertTriangle,
  info: Info,
  error: AlertCircle,
} as const;

export function Toast({
  children,
  dataLeaving = false,
  onClose,
  tone,
}: ToastProps): React.JSX.Element {
  const Icon = TOAST_ICONS[tone];
  return (
    <div
      className="toast"
      data-leaving={dataLeaving ? "true" : undefined}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={17} aria-hidden="true" />
      <span>{children}</span>
      {onClose === undefined ? null : (
        <button aria-label="关闭提示" className="toast-close" onClick={onClose} type="button">
          <X aria-hidden="true" size={14} />
        </button>
      )}
    </div>
  );
}
