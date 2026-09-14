# Architecture

## System Overview

DNF 补丁管理器是一个 Windows Electron 桌面应用。主进程负责文件系统、窗口、IPC 和自动更新，渲染进程负责 React 界面，`src/core` 按业务域实现补丁库、安装、分组、回收站和状态持久化。

## Component Map

| Component | Responsibility | Key Files |
|---|---|---|
| Main process | Window lifecycle, IPC, update integration | `src/main/` |
| Preload/shared | Renderer bridge and shared contracts | `src/preload/`, `src/shared/` |
| Renderer | React workspace, settings and visual presentation | `src/renderer/` |
| Library | Scan, import, classify, move and preview patches | `src/core/library/` |
| Install | Enable, disable, migrate and boundary checks | `src/core/install/` |
| Recycle | Recycle-bin manifest, delete and restore | `src/core/recycle/` |
| State | Atomic JSON persistence and schema validation | `src/core/state/` |

## Dependency Rules

- `src/renderer/` accesses native operations through the preload bridge and shared IPC contracts.
- `src/main/` owns Electron APIs and IPC handlers; renderer code must not import Electron directly.
- `src/core/` contains reusable business logic and should not depend on renderer components.
- `tests/` may depend on application modules, but production modules must not depend on tests.

## Data Flow

User actions in React call preload APIs. IPC handlers validate the request and delegate to `src/core` services. Core services perform bounded filesystem transactions and persist state atomically. Results return through IPC and update the renderer state.

## Key Decisions

| Decision | Rationale | Date |
|---|---|---|
| Electron + React + TypeScript | Reuse the existing desktop UI and filesystem boundary | 2026-09-14 |
| NSIS is the release installer | Supports choosing an installation directory and electron-updater integration | 2026-09-14 |
