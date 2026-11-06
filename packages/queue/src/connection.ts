import { Queue, Worker, type QueueOptions, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function createQueue<T = unknown>(
  name: string,
  options?: Partial<QueueOptions>
): Queue<T> {
  return new Queue<T>(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
    ...options,
  });
}

export function createWorker<T = unknown, R = any>(
  name: string,
  processor: (job: any) => Promise<R>,
  options?: Partial<WorkerOptions>
): Worker<T, R> {
  return new Worker<T, R>(name, processor, {
    connection: getRedisConnection(),
    concurrency: 5,
    ...options,
  });
}
