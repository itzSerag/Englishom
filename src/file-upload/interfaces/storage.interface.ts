export interface FileStorageInterface {
  uploadFile(
    file: Express.Multer.File,
    key: string,
    bucket?: string,
  ): Promise<{ url: string }>;

  deleteFile(key: string, bucket?: string): Promise<void>;

  getFileUrl(key: string, bucket?: string): { url: string };

  fileExists(key: string, bucket?: string): Promise<boolean>;

  listFiles(prefix: string, bucket?: string): Promise<{ url: string }[]>;

  getFile(key: string, bucket?: string): Promise<Buffer>;
}