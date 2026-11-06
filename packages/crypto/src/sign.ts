import { createSign, createVerify, generateKeyPairSync } from "crypto";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateSigningKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

export function signData(data: string, privateKey: string): string {
  const sign = createSign("SHA256");
  sign.update(data);
  return sign.sign(privateKey, "hex");
}

export function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  const verify = createVerify("SHA256");
  verify.update(data);
  return verify.verify(publicKey, signature, "hex");
}
