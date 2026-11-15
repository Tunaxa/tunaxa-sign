import { createStorageClient } from "@axa-sign/storage";
import { app } from "./app";
import { registerEventHandlers } from "./events/register";
import { SigningService } from "./modules/signing/signing.service";
import { CertificateService } from "./modules/certificates/certificate.service";

const PORT = process.env.PORT || 3000;

async function main() {
  // Wire domain events to side effects (email, webhooks, certificates)
  registerEventHandlers(new SigningService(), new CertificateService());

  await createStorageClient().ensureBucket();
  console.log(`[API] Storage bucket ready: ${process.env.STORAGE_BUCKET || "axa-sign"}`);

  app.listen(PORT, () => {
    console.log(`[API] AXA Sign API running on port ${PORT}`);
    console.log(`[API] Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

main().catch((err) => {
  console.error("[API] Fatal error:", err);
  process.exit(1);
});