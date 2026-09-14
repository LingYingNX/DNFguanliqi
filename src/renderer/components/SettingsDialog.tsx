import {
  Bookmark,
  CheckCircle2,
  Download,
  ExternalLink,
  Folder,
  Github,
  Heart,
  Info,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppUpdate } from "../workspace/useAppUpdate";
import { Dialog } from "./Dialog";
import { CommandButton } from "./primitives";

type SupportUrl =
  | "https://afdian.com/a/naixu"
  | "https://github.com/LingYingNX/DNFguanliqi"
  | "https://qm.qq.com/q/ZxPw28W7eg"
  | "https://space.bilibili.com/41344302";
type SettingsSection = "general" | "recommended" | "about";

type Props = {
  readonly currentVersion: string;
  readonly gameDirectory: string | null;
  readonly gameDirectoryBusy: boolean;
  readonly onClose: () => void;
  readonly onOpenExternalUrl: (url: SupportUrl) => void;
  readonly onSelectGameDirectory: () => Promise<string | null>;
  readonly onSetGameDirectory: (value: string) => Promise<boolean>;
  readonly update: AppUpdate;
};

const NAV_ITEMS = [
  { icon: SettingsIcon, key: "general", label: "常规设置" },
  { icon: Sparkles, key: "recommended", label: "推荐内容" },
  { icon: Info, key: "about", label: "关于软件" },
] as const satisfies readonly {
  readonly icon: typeof SettingsIcon;
  readonly key: SettingsSection;
  readonly label: string;
}[];

const SUPPORT_LINKS = [
  {
    actionLabel: "去赞助",
    description: "本软件完全免费且开源。如果您觉得它有帮助，欢迎前往爱发电给予我持续维护的动力！",
    icon: Heart,
    key: "afdian",
    name: "请作者喝杯咖啡 ☕",
    url: "https://afdian.com/a/naixu",
  },
  {
    actionLabel: "去关注",
    description: "关注最新动态、视频教程与更新发布",
    icon: Bookmark,
    key: "bilibili",
    name: "哔哩哔哩主页",
    url: "https://space.bilibili.com/41344302",
  },
] as const;

const PROJECT_LINKS = [
  {
    icon: Github,
    label: "项目地址",
    url: "https://github.com/LingYingNX/DNFguanliqi",
  },
  {
    icon: Users,
    label: "QQ群交流",
    url: "https://qm.qq.com/q/ZxPw28W7eg",
  },
] as const;

const CHANGELOG = [
  "重构设置中心，支持常规设置、推荐内容与关于软件导航。",
  "优化补丁预览图读取与替换流程，减少缓存导致的显示错误。",
  "改进分类、组和补丁卡片的交互与布局表现。",
  "修复若干启动、扫描和文件同步问题。",
] as const;

const UPDATE_STATUS: Record<AppUpdate["phase"], string> = {
  idle: "点击检查更新获取最新版本",
  checking: "正在检查更新",
  available: "已检测到新版本",
  current: "当前版本已是最新版",
  downloading: "正在下载更新",
  downloaded: "更新包下载完成",
  failed: "更新失败",
};

export function SettingsDialog(props: Props): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>("general");
  const [draft, setDraft] = useState(props.gameDirectory ?? "");
  const update = props.update;
  const progressValue =
    update.phase === "downloaded" ? 100 : update.phase === "downloading" ? update.progress : 0;

  useEffect(() => {
    setDraft(props.gameDirectory ?? "");
  }, [props.gameDirectory]);

  const commit = (): void => {
    const nextDirectory = draft.trim();
    if (nextDirectory.length === 0 || nextDirectory === (props.gameDirectory ?? "")) return;
    void props.onSetGameDirectory(nextDirectory);
  };

  return (
    <Dialog
      backdropClassName="settings-dialog-backdrop"
      className="settings-dialog-panel"
      hideHeader
      onClose={props.onClose}
      title="设置"
    >
      <div className="settings-dialog-layout">
        <aside className="settings-sidebar">
          <nav aria-label="设置导航" className="settings-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const selected = section === item.key;
              return (
                <button
                  aria-selected={selected}
                  className="settings-nav-item"
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="settings-content" role="tabpanel">
          <button
            aria-label="关闭对话框"
            className="settings-content-close"
            onClick={props.onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
          <div className="settings-content-body">
            {section === "general" ? (
              <section className="settings-detail-section">
                <div className="settings-detail-heading">
                  <h3>游戏目录</h3>
                  <p>选择 DNF 游戏目录，补丁启用和文件同步会使用这个位置。</p>
                </div>
                <div className="settings-path-row">
                  <input
                    aria-label="游戏目录"
                    className="settings-path-input"
                    data-dialog-initial-focus="true"
                    disabled={props.gameDirectoryBusy}
                    id="game-directory"
                    onBlur={commit}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                      }
                    }}
                    placeholder="请输入或粘贴游戏目录"
                    spellCheck={false}
                    type="text"
                    value={draft}
                  />
                  <CommandButton
                    aria-label="浏览"
                    className="settings-browse-button"
                    disabled={props.gameDirectoryBusy}
                    icon={<Folder size={16} />}
                    loading={props.gameDirectoryBusy}
                    onClick={async () => {
                      const selectedDirectory = await props.onSelectGameDirectory();
                      if (selectedDirectory !== null) setDraft(selectedDirectory);
                    }}
                    title="浏览游戏目录"
                  >
                    浏览
                  </CommandButton>
                </div>
              </section>
            ) : section === "recommended" ? (
              <section className="settings-empty-state">
                <Sparkles aria-hidden="true" size={28} />
                <h3>推荐内容</h3>
                <p>推荐内容功能正在准备中，后续会在这里展示精选资源和实用功能。</p>
              </section>
            ) : (
              <section className="settings-detail-section">
                <article className="settings-update-card">
                  <div className="settings-update-header">
                    <div>
                      <h3>软件更新</h3>
                      <span className="settings-update-status">
                        {update.phase === "available" && update.latestVersion !== null
                          ? `已检测到新版本 v${update.latestVersion}`
                          : (update.message ?? UPDATE_STATUS[update.phase])}
                      </span>
                    </div>
                    <div className="settings-version-stack">
                      <span className="settings-version-badge">
                        当前版本 v{props.currentVersion}
                      </span>
                      <span className="settings-latest-version">
                        最新版本 v{update.latestVersion ?? props.currentVersion}
                      </span>
                    </div>
                  </div>
                  <div className="settings-changelog-heading">更新说明</div>
                  <ul className="settings-changelog">
                    {CHANGELOG.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                  <div className="settings-update-footer">
                    <div className="settings-progress-info">
                      <span>
                        {update.phase === "downloading"
                          ? `正在下载更新 (${update.progress}%)`
                          : update.phase === "downloaded"
                            ? "下载完成，点击重启安装"
                            : "更新进度"}
                      </span>
                      <span>{progressValue}%</span>
                    </div>
                    <progress
                      aria-label="更新进度"
                      className="settings-update-progress"
                      max={100}
                      value={progressValue}
                    />
                    <div className="settings-update-actions">
                      <button
                        className="settings-update-secondary"
                        disabled={update.phase === "checking" || update.phase === "downloading"}
                        onClick={() => void update.check()}
                        type="button"
                      >
                        <RefreshCw aria-hidden="true" size={14} />
                        检查更新
                      </button>
                      <button
                        className="settings-update-primary"
                        disabled={update.phase !== "available" && update.phase !== "downloaded"}
                        onClick={() =>
                          void (update.phase === "downloaded"
                            ? update.install()
                            : update.download())
                        }
                        type="button"
                      >
                        {update.phase === "downloaded" ? (
                          <CheckCircle2 aria-hidden="true" size={14} />
                        ) : (
                          <Download aria-hidden="true" size={14} />
                        )}
                        {update.phase === "downloaded" ? "重启安装" : "立即更新"}
                      </button>
                    </div>
                  </div>
                </article>
                <div className="settings-project-links">
                  {PROJECT_LINKS.map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <button
                        className="settings-update-secondary settings-project-link"
                        key={link.label}
                        onClick={() => props.onOpenExternalUrl(link.url)}
                        type="button"
                      >
                        <LinkIcon aria-hidden="true" size={14} />
                        {link.label}
                      </button>
                    );
                  })}
                </div>
                <div className="settings-support-list">
                  {SUPPORT_LINKS.map((link) => {
                    const PlatformIcon = link.icon;
                    return (
                      <article
                        className="settings-support-card"
                        data-support={link.key}
                        key={link.key}
                      >
                        <div className="settings-support-copy">
                          <span aria-hidden="true" className="settings-support-icon">
                            <PlatformIcon size={17} strokeWidth={1.9} />
                          </span>
                          <div>
                            <strong>{link.name}</strong>
                            <span>{link.description}</span>
                          </div>
                        </div>
                        <div className="settings-support-actions">
                          <button
                            aria-label={link.actionLabel}
                            className="settings-support-button"
                            onClick={() => props.onOpenExternalUrl(link.url)}
                            type="button"
                          >
                            <span>{link.actionLabel}</span>
                            <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </Dialog>
  );
}
