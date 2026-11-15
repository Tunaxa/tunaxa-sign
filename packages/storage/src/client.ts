import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfig, UploadResult } from "./types";

const DEFAULT_RETRIES = 10;
const DEFAULT_RETRY_DELAY_MS = 1000;

export class StorageClient {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.client = new S3Client({
      endpoint: `http${config.useSSL ? "s" : ""}://${config.endpoint}:${config.port}`,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
    this.bucket = config.bucket;
  }

  async ensureBucket(
    retries = DEFAULT_RETRIES,
    delayMs = DEFAULT_RETRY_DELAY_MS
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return;
      } catch (error) {
        if (isMissingBucket(error)) {
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
            return;
          } catch (createError) {
            if (isBucketAlreadyOwned(createError)) {
              return;
            }
            lastError = createError;
          }
        } else {
          lastError = error;
        }
      }

      if (attempt < retries - 1) {
        await delay(delayMs);
      }
    }

    if (lastError) throw lastError;
    throw new Error(`Failed to ensure storage bucket: ${this.bucket}`);
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    const result = await this.client.send(command);
    return {
      key,
      bucket: this.bucket,
      size: body.length,
      etag: result.ETag || "",
    };
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const result = await this.client.send(command);
    const stream = result.Body;
    if (!stream) throw new Error("Empty response from storage");

    const chunks: Uint8Array[] = [];
    const reader = stream.transformToWebStream().getReader();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }

    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}

export function createStorageClient(overrides: Partial<StorageConfig> = {}): StorageClient {
  return new StorageClient({
    endpoint: process.env.STORAGE_ENDPOINT || "localhost",
    port: Number(process.env.STORAGE_PORT) || 9000,
    bucket: process.env.STORAGE_BUCKET || "axa-sign",
    accessKey: process.env.STORAGE_ACCESS_KEY || "minioadmin",
    secretKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
    useSSL: process.env.STORAGE_USE_SSL === "true",
    ...overrides,
  });
}

function isMissingBucket(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.$metadata?.httpStatusCode === 404 ||
    e.name === "NotFound" ||
    e.name === "NoSuchBucket"
  );
}

function isBucketAlreadyOwned(error: unknown): boolean {
  const e = error as { name?: string };
  return e.name === "BucketAlreadyOwnedByYou" || e.name === "BucketAlreadyExists";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
