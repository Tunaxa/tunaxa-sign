import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfig, UploadResult } from "./types";

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
