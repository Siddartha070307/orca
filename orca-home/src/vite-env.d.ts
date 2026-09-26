/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCGIS_API_KEY?: string;
  readonly VITE_INCOIS_WMS_URL?: string;
  readonly VITE_INCOIS_WFS_URL?: string;
  readonly VITE_IMD_API_URL?: string;
  readonly VITE_COPERNICUS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
