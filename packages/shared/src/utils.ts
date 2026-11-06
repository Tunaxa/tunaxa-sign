import { randomBytes, createHash } from "crypto";

export function generateId(prefix?: string): string {
  const id = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function paginate(page: number = 1, limit: number = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const skip = (safePage - 1) * safeLimit;
  return { skip, take: safeLimit, page: safePage, limit: safeLimit };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}
