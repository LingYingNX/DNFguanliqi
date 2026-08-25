import { Bookmark, ExternalLink, Folder, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { CommandButton } from "./primitives";

type SupportUrl = "https://afdian.com/a/naixu" | "https://space.bilibili.com/41344302";

type Props = {
  readonly gameDirectory: string | null;
  readonly gameDirectoryBusy: boolean;
  readonly onClose: () => void;
  readonly onOpenExternalUrl: (url: SupportUrl) => void;
  readonly onSelectGameDirectory: () => Promise<string | null>;
  readonly onSetGameDirectory: (value: string) => Promise<boolean>;
};

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

export function SettingsDialog(props: Props): React.JSX.Element {
  const [draft, setDraft] = useState(props.gameDirectory ?? "");

  useEffect(() => {
    setDraft(props.gameDirectory ?? "");
  }, [props.gameDirectory]);

  const commit = (): void => {
    const nextDirectory = draft.trim();
    if (nextDirectory.length === 0 || nextDirectory === (props.gameDirectory ?? "")) return;
    void props.onSetGameDirectory(nextDirectory);
  };

  return (
    <Dialog className="settings-dialog-panel" onClose={props.onClose} title="设置">
      <div className="settings-dialog-body settings-only-dialog">
        <section className="settings-path-section">
          <label className="settings-path-label" htmlFor="game-directory">
            游戏目录
          </label>
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
        <section aria-labelledby="support-links-heading" className="settings-support-section">
          <h3 id="support-links-heading">支持与社区</h3>
          <div className="settings-support-list">
            {SUPPORT_LINKS.map((link) => {
              const PlatformIcon = link.icon;
              return (
                <article className="settings-support-card" data-support={link.key} key={link.key}>
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
      </div>
    </Dialog>
  );
}
