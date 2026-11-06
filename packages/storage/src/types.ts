export interface StorageConfig {
  endpoint: string;
  port: number;
  bucket: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
}

export interface UploadResult {
  key: string;
  bucket: string;
  size: number;
  etag: string;
}

export interface StorageFolders {
  ORIGINAL: string;
  PROCESSED: string;
  SIGNED: string;
  CERTIFICATES: string;
  AUDIT: string;
  TEMPLATES: string;
  AVATARS: string;
}

export const STORAGE_FOLDERS: StorageFolders = {
  ORIGINAL: "original",
  PROCESSED: "processed",
  SIGNED: "signed",
  CERTIFICATES: "certificates",
  AUDIT: "audit",
  TEMPLATES: "templates",
  AVATARS: "avatars",
};
