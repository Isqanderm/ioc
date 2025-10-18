import { Injectable, Inject } from 'nexus-ioc';
import { ConfigService } from '../../core/config/config.service';
import { LoggerService } from '../../core/logger/logger.service';

export interface UploadedFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface UploadOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
}

@Injectable()
export class StorageService {
  private files: Map<string, UploadedFile> = new Map();

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {
    this.logger.info('Storage service initialized', 'StorageService');
  }

  async upload(
    file: { filename: string; mimetype: string; size: number; buffer: Buffer },
    options?: UploadOptions
  ): Promise<UploadedFile> {
    // Validate file size
    if (options?.maxSize && file.size > options.maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
    }

    // Validate mime type
    if (options?.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const uploadedFile: UploadedFile = {
      id: fileId,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${fileId}/${file.filename}`,
      uploadedAt: new Date()
    };

    this.files.set(fileId, uploadedFile);

    this.logger.info(`File uploaded: ${file.filename} (${file.size} bytes)`, 'StorageService');

    return uploadedFile;
  }

  async get(fileId: string): Promise<UploadedFile | null> {
    const file = this.files.get(fileId);

    if (!file) {
      this.logger.warn(`File not found: ${fileId}`, 'StorageService');
      return null;
    }

    return file;
  }

  async delete(fileId: string): Promise<boolean> {
    const deleted = this.files.delete(fileId);

    if (deleted) {
      this.logger.info(`File deleted: ${fileId}`, 'StorageService');
    } else {
      this.logger.warn(`File not found for deletion: ${fileId}`, 'StorageService');
    }

    return deleted;
  }

  async list(): Promise<UploadedFile[]> {
    return Array.from(this.files.values());
  }
}

