interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_DISABLE_REACT_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
