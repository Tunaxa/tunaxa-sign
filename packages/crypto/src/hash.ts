import { createHash, randomBytes } from "crypto";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function generateNonce(length: number = 16): string {
  return randomBytes(length).toString("hex");
}

export interface HashChainEntry {
  data: string;
  hash: string;
  previousHash: string;
  timestamp: Date;
}

export function createHashChain(
  entries: string[],
  previousHash: string = ""
): HashChainEntry[] {
  const chain: HashChainEntry[] = [];
  let lastHash = previousHash;

  for (const data of entries) {
    const hash = sha256(data + lastHash);
    chain.push({
      data,
      hash,
      previousHash: lastHash,
      timestamp: new Date(),
    });
    lastHash = hash;
  }

  return chain;
}

export function verifyHashChain(chain: HashChainEntry[]): boolean {
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i - 1].hash) {
      return false;
    }
    const expectedHash = sha256(chain[i].data + chain[i].previousHash);
    if (chain[i].hash !== expectedHash) {
      return false;
    }
  }
  return true;
}
