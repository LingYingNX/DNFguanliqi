# Routes

This is an Electron React application without a URL router.

| View | Entry | Layout |
| --- | --- | --- |
| Main workspace | `src/renderer/App.tsx` -> `WorkspaceApp` | Custom title bar, sidebar, content workspace |
| Primitive showcase | `src/renderer/App.tsx?showcase=1` | Standalone showcase |
| Appearance dialog | Opened from `WorkspaceApp` | `Dialog` over main workspace |

The requested target is the existing appearance dialog, not a new route.
