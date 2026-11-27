import { createStorageClient } from "@axa-sign/storage";
import { startDocumentWorker } from "./document.worker";
import { startEmailWorker } from "./email.worker";
import { startWebhookWorker } from "./webhook.worker";
import { startCleanupWorker } from "./cleanup.worker";

async function main() {
  console.log("[Workers] Starting AXA Sign workers...");

  await createStorageClient().ensureBucket();
  console.log(`[Workers] Storage bucket ready: ${process.env.STORAGE_BUCKET || "axa-sign"}`);

  startDocumentWorker();
  startEmailWorker();
  startWebhookWorker();
  startCleanupWorker();

  console.log("[Workers] All workers started");

  process.on("SIGTERM", () => {
    console.log("[Workers] Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Workers] Fatal error:", err);
  process.exit(1);
});
