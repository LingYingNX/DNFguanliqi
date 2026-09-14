# ADR 0001: Use Custom Window Chrome

- Status: Accepted
- Date: 2026-08-02

## Context

The desktop workbench needs to remove the unwanted native window border while keeping familiar window operations. The existing Electron window uses the platform frame, so the renderer cannot control the visual border or place the three window controls inside the application surface.

## Decision

Use a frameless Electron window with a renderer-owned title bar. Keep the standard control order: minimize, maximize or restore, then close. Only the empty title-bar region is draggable; the controls remain non-draggable. The main process owns the window operations and reports maximize state to the renderer through the existing IPC boundary.

## Alternatives Considered

- Keep the native frame and remove only a content separator. This cannot remove the platform-drawn outer border or reposition the native controls.
- Hide the controls entirely. This removes familiar window operations and is not acceptable for a desktop workbench.

## Consequences

- Window controls need explicit IPC and keyboard-accessible renderer buttons.
- The title bar must preserve stable dimensions and leave the control group outside the drag region.
- Future changes to window chrome must update both the main-process behavior and the renderer contract.
