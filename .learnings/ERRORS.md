# Errors

Command failures and integration errors.

---

## [ERR-20260819-001] launcher-pnpm-path

**Logged**: 2026-08-19T00:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra, launcher

### Summary
桌面双击启动器时，如果 Explorer 继承的 PATH 不包含 pnpm，BAT 会立即退出，用户只看到软件无法打开。

### Context
- Operation: `启动DNF补丁管理器.bat --check`
- Reproduction: 在仅包含 `C:\Windows\System32` 的隔离 PATH 下，原脚本输出 `pnpm was not found on PATH.`
- Root cause: 启动器把 PATH 中的 pnpm 当作唯一包管理器入口，没有使用系统 Node.js 自带的 Corepack 回退。

### Resolution
- `启动DNF补丁管理器.bat` 现在优先使用 PATH 中的 pnpm；缺失时回退到 `C:\Program Files\nodejs\corepack.cmd pnpm`。
- 隔离 PATH 检查、正常 PATH 检查和真实 Electron 启动测试均通过。

### Metadata
- Related Files: `启动DNF补丁管理器.bat`
- Pattern-Key: launcher.pnpm-path
- Recurrence-Count: 1

---

## [ERR-20260819-002] electron-cache-contention

**Logged**: 2026-08-19T10:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: launcher, electron

### Summary
重复启动开发版应用时，多个 Electron 实例争用同一个 `data\\electron` 缓存目录，Chromium 报拒绝访问并可能导致窗口无法出现。

### Context
- Operation: 通过 BAT 启动并检查 Electron 进程。
- Error: `Unable to move the cache: 拒绝访问` and `Gpu Cache Creation failed`。
- Root cause: 主进程没有调用 Electron 单实例锁，重复启动会同时使用同一份 userData/sessionData。

### Resolution
- `src/main/main.ts` 现在请求 `app.requestSingleInstanceLock()`。
- 第二个实例退出，并把已有窗口恢复、聚焦。
- 主进程单元测试和真实启动 E2E 均通过。

### Metadata
- Related Files: `src/main/main.ts`, `tests/main-window-registration.test.ts`
- Pattern-Key: electron.single-instance-cache
- Recurrence-Count: 1

---

## [ERR-20260819-003] launcher-hidden-desktop-error

**Logged**: 2026-08-19T11:00:00+08:00
**Priority**: high
**Status**: mitigated
**Area**: launcher, diagnostics

### Summary
终端启动成功不能证明资源管理器双击成功；双击环境的 PATH、权限和错误输出不同，BAT 失败时窗口会直接关闭，导致用户无法看到根因。

### Resolution
- `启动DNF补丁管理器.bat` 现在把启动过程和 Electron 标准错误追加到 `data\\launcher.log`。
- Electron 非零退出时，启动器显示日志路径并暂停窗口，保留现场信息。
- 仍需用户在实际桌面环境双击一次，以获取该环境的具体日志内容。

### Metadata
- Related Files: `启动DNF补丁管理器.bat`, `data/launcher.log`
- Pattern-Key: launcher.desktop-environment
- Recurrence-Count: 1

---

## [ERR-20260803-001] session-events-unicode-output

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: docs

### Summary
Codex 会话投影器在 Windows GBK stdout 下遇到不可编码 Unicode 字符而中止。

### Error
UnicodeEncodeError: 'gbk' codec can't encode character

### Context
- Operation: project a large Codex JSONL transcript with session-events.py
- Cause: PowerShell/console output encoding was not UTF-8
- Impact: first projection of the large 019fc14e transcript exited non-zero; no project files were changed

### Suggested Fix
Use python -X utf8 for transcript projection and keep raw transcript bodies out of console output.

### Metadata
- Reproducible: yes
- Related Files: C:\Users\LYNX\.agents\skills\agent-session-resume\scripts\session-events.py
- Pattern-Key: shell.unicode-output

### Resolution
- Resolved: 2026-08-03T17:50:00+08:00
- Notes: Re-ran the projection with UTF-8 mode and completed the evidence pass.

---

## [ERR-20260803-002] thread-list-limit

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
Codex thread listing rejects a limit greater than 50.

### Error
list_threads received invalid arguments: limit: Too big: expected number to be <=50.

### Context
- Operation: initial read-only Codex thread index query
- Impact: no data changed; the query was retried with limit=50, then the filesystem candidate lister was used for completeness

### Suggested Fix
Use limit=50 for the app index and use session-candidates.py --limit 200 for local transcript inventory.

### Metadata
- Reproducible: yes
- Related Files: C:\Users\LYNX\.codex\sessions
- Pattern-Key: shell.tool-argument-limit

### Resolution
- Resolved: 2026-08-03T17:40:00+08:00
- Notes: Candidate inventory completed; 32 unique exact-cwd transcript paths were found including the active thread.

---

## [ERR-20260803-003] powershell-nested-variable-expansion

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: config

### Summary
Nested PowerShell commands expanded $doc and $_.Name in the outer shell before the inner command ran.

### Error
You must provide a value expression following the '+' operator.

### Context
- Operation: parse projected JSON and inspect target-directory files through rtk powershell
- Cause: outer PowerShell interpolated inner script variables
- Impact: inspection command failed; no project data was modified

### Suggested Fix
Escape inner PowerShell variables with backticks or use an isolated script invocation; keep each diagnostic command small.

### Metadata
- Reproducible: yes
- Related Files: RTK.md, C:\Users\LYNX\.agents\skills\agent-session-resume\scripts
- Pattern-Key: shell.nested-expansion

### Resolution
- Resolved: 2026-08-03T17:55:00+08:00
- Notes: Re-ran the structured projection with escaped variables and completed the inspection.

---

## [ERR-20260803-004] apply-patch-terminator

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
The first multi-file apply_patch request was rejected because its final marker was not parsed as the exact last line.

### Error
apply_patch verification failed: invalid patch: The last line of the patch must be '*** End Patch'

### Context
- Operation: initialize the standard .learnings files
- Impact: no file was written by the failed patch

### Suggested Fix
Use a patch string whose final line is exactly *** End Patch, then verify the result.

### Metadata
- Reproducible: yes
- Related Files: .learnings/LEARNINGS.md, .learnings/ERRORS.md, .learnings/FEATURE_REQUESTS.md
- Pattern-Key: shell.patch-format

### Resolution
- Resolved: 2026-08-03T17:57:00+08:00
- Notes: The three standard files were initialized in a subsequent valid patch.

---

## [ERR-20260803-005] resume-skill-provenance-path-mismatch

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
The provenance helper does not recognize the loaded skill under C:\Users\LYNX\.agents.

### Error
The helper reported repo/Codex/Claude comparison surfaces as missing, while the loaded file was C:\Users\LYNX\.agents\skills\agent-session-resume\SKILL.md.

### Context
- Operation: required provenance self-check from agent-session-resume
- Impact: source/version comparison remains unknown; session evidence is still usable, but the provenance report must not claim version parity

### Suggested Fix
Update the helper or record .agents as an explicit supported installation surface.

### Metadata
- Reproducible: yes
- Related Files: C:\Users\LYNX\.agents\skills\agent-session-resume\SKILL.md
- Pattern-Key: config.skill-provenance-path

---

## [ERR-20260803-006] yaml-validation-nested-powershell

**Logged**: 2026-08-03T17:50:32+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
YAML 验证命令在进入解析阶段前因嵌套 PowerShell 引号失败。

### Error
```
PowerShell nested-command parsing failure; validation exited before YAML parsing.
```

### Context
- Operation: validate `E:\BaiduSyncdisk\知识库\DNF补丁管理器\mempalace.yaml`
- Cause: the outer PowerShell interpreted quoting/variables intended for the nested command
- Impact: this attempt did not establish whether the YAML content was valid; no files were modified
- The failed attempt is recorded as a command error, not as evidence that the YAML content is invalid

### Suggested Fix
Use a direct parser invocation in one shell without nested PowerShell quoting, then inspect the parsed structure.

### Metadata
- Reproducible: yes
- Related Files: `E:\BaiduSyncdisk\知识库\DNF补丁管理器\mempalace.yaml`
- See Also: ERR-20260803-003
- Pattern-Key: shell.nested-expansion
- Recurrence-Count: 2

### Resolution
- Resolved: 2026-08-03T17:53:00+08:00
- Notes: Parsed the file with Python's YAML parser in a single shell; `rooms.general` and its keyword list validated successfully.

---

## [ERR-20260803-007] apply-patch-anchor-mismatch

**Logged**: 2026-08-03T17:51:00+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
The first attempt to append the YAML validation error used a text anchor that was not present in the existing error log.

### Error
```
apply_patch verification failed: Failed to find expected lines in .learnings/ERRORS.md
```

### Context
- Operation: append the new validation error to the project and knowledge-base logs
- Cause: the patch assumed a `Notes` line that the actual entry did not contain
- Impact: no file was written by the failed patch

### Suggested Fix
Read the exact file tail before constructing the patch anchor; use the existing final separator or final line.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`, `E:\BaiduSyncdisk\知识库\DNF补丁管理器\错误记录.md`
- Pattern-Key: shell.patch-anchor

### Resolution
- Resolved: 2026-08-03T17:52:00+08:00
- Notes: Re-read both file tails and prepared a patch against the actual content.

---

## [ERR-20260803-008] broad-status-patch-match

**Logged**: 2026-08-03T17:54:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: docs

### Summary
A status-only patch matched the first pending entry instead of the intended YAML validation entry.

### Error
```
Patch applied successfully but changed unrelated pending statuses because the match was not scoped to a unique entry.
```

### Context
- Operation: close the YAML validation error after parser verification
- Impact: `ERR-20260803-005` and the knowledge-base preview-lifecycle item were temporarily changed to resolved
- Correction: restored both unrelated entries and scoped the intended status changes to their section headers

### Suggested Fix
Always include a unique entry header and nearby context when changing status fields in append-only logs.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`, `E:\BaiduSyncdisk\知识库\DNF补丁管理器\错误记录.md`
- Pattern-Key: shell.patch-anchor
- See Also: ERR-20260803-007
- Recurrence-Count: 2

---

## [ERR-20260803-009] diagnostic-nested-powershell-expansion

**Logged**: 2026-08-03T17:55:00+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
Two line-number inspection commands lost their inner PowerShell variables before execution.

### Error
```
PowerShell parser errors: missing expressions after variable names because $lines and $i were expanded by the outer shell.
```

### Context
- Operation: inspect exact log lines before constructing a status repair patch
- Cause: nested PowerShell command was passed through an outer PowerShell without escaping `$lines`, `$i`, and the format expression
- Impact: both diagnostic commands failed before reading files; no files were modified

### Suggested Fix
Use simple tail reads for inspection or pass a single-layer command with variables protected from outer-shell expansion.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`, `E:\BaiduSyncdisk\知识库\DNF补丁管理器\错误记录.md`
- Pattern-Key: shell.nested-expansion
- Recurrence-Count: 2

---

## [ERR-20260803-010] verification-regex-construction

**Logged**: 2026-08-03T17:56:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The final log-status assertion script built an invalid regular expression from an ID containing hyphens.

### Error
```
re.PatternError: bad character range R-2 at position 8
```

### Context
- Operation: assert the status of selected error entries
- Cause: the dynamically constructed character class did not escape the entry ID
- Impact: the assertion command stopped before checking statuses; no files were modified

### Suggested Fix
Use exact string section splitting for fixed log IDs, or escape dynamic values before building a regular expression.

### Metadata
- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`
- Pattern-Key: tests.invalid-assertion

### Resolution
- Resolved: 2026-08-03T17:57:00+08:00
- Notes: Replaced the dynamic regular expression with deterministic string section parsing.

---

## [ERR-20260803-011] verification-hash-nested-powershell

**Logged**: 2026-08-03T17:56:30+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
The final SHA-256 listing command lost `$_` member expressions through outer PowerShell expansion.

### Error
```
PowerShell parser error: You must provide a value expression following the '-f' operator.
```

### Context
- Operation: list target knowledge-base file sizes and SHA-256 hashes
- Cause: the outer shell expanded `$_` before the nested PowerShell command executed
- Impact: the hash listing did not run; no files were modified

### Suggested Fix
Use Python's filesystem and hashing APIs for deterministic file verification, or protect all nested PowerShell variables.

### Metadata
- Reproducible: yes
- Related Files: `E:\BaiduSyncdisk\知识库\DNF补丁管理器`
- Pattern-Key: shell.nested-expansion
- Recurrence-Count: 3
- See Also: ERR-20260803-003, ERR-20260803-006, ERR-20260803-009

### Resolution
- Resolved: 2026-08-03T17:58:00+08:00
- Notes: Replaced the hash listing with a single-layer Python verification command.

## [ERR-20260804-001] git-incomplete-merge

**Logged**: 2026-08-04T13:06:24+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
用户报告 worktree 分支合并到 master 后功能没有出现；根因是操作逻辑分支的提交从未真正进入 master。

### Error
软件没有多出 worktrees 分支功能；master 检查显示只包含外观分支结果，缺少手动游戏目录输入、递归分类/补丁计数、分类移动、拖放和框选。

### Context
- Operation: 将 `操作逻辑` 合并到 `master`
- Expected: `939c37f` 和 `b0b8203` 进入 master
- Actual: master 停留在 `e1d4a7a`，操作逻辑功能全部缺失
- Cause: 之前的操作只把外观分支纳入 master，没有真正执行包含操作逻辑的合并；不是冲突覆盖，而是提交从未合并

### Suggested Fix
在独立 worktree 中执行真实 `git merge --no-ff`，逐项解决冲突，并在提交前验证 `master` 已包含操作逻辑 head。

### Metadata
- Reproducible: yes
- Related Files: E:\codex目录\DNF, src/shared/ipc-contracts.ts, src/renderer/components/ItemWorkspace.tsx, tests/e2e
- Pattern-Key: vcs.incomplete-merge
- Recurrence-Count: 1

### Resolution
- Resolved: 2026-08-04T13:06:24+08:00
- Commit/PR: f0ee8cd
- Notes: 已生成真实合并提交 f0ee8cd，父提交为 e1d4a7a 和 b0b8203；相关 typecheck/lint/单元/集成/E2E 验证通过，已切换到 master 并清理已合并分支。

---

## [ERR-20260811-001] electron-renderer-crash

**Logged**: 2026-08-11T16:47:00+08:00
**Priority**: medium
**Status**: blocked
**Area**: tests

### Summary
Playwright Electron E2E 在当前 Windows 环境启动时，GPU 子进程缺失依赖 DLL 并导致渲染页崩溃。

### Error
```
GPU process exited unexpectedly: exit_code=-1073741515
page.waitForTimeout: Page crashed
```

### Context
- Operation: 运行 `tests/e2e/appearance.e2e.ts` 并直接启动 Electron 诊断。
- The same crash occurred with a dedicated `--user-data-dir`, `--disable-gpu`, and `--in-process-gpu`.
- The renderer aborted loading `out/renderer/index.html` before application UI could be exercised.

### Suggested Fix
修复本机 Electron/Chromium GPU 运行时缺少的依赖后，重新运行单文件 E2E，再运行完整 E2E。

### Metadata
- Reproducible: yes
- Related Files: tests/e2e/appearance.e2e.ts
- Pattern-Key: tests.electron-renderer-crash
- Recurrence-Count: 1
- First-Seen: 2026-08-11
- Last-Seen: 2026-08-11

---

## [ERR-20260811-002] openspec-cli-unavailable

**Logged**: 2026-08-11T17:08:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
当前 PowerShell 环境未安装或未暴露 `openspec` CLI。

### Error
```
openspec : 无法将“openspec”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
```

### Context
- Operation: 按 xunwen-openspec 工作流读取 change 状态。
- Impact: 无法列出 OpenSpec change；本次属于无需 change 的局部代码精简，已按直接处理路径继续。

### Suggested Fix
如后续需要创建或管理 OpenSpec change，先安装并验证 OpenSpec CLI；局部维护不因此阻塞。

### Metadata
- Reproducible: yes
- Related Files: .agents/skills/xunwen-openspec/SKILL.md
- Pattern-Key: shell.command-not-found
- Recurrence-Count: 1

### Resolution
- **Resolved**: 2026-08-11T17:08:00+08:00
- **Notes**: 本次使用仓库原生检查和测试完成直接处理。

---
