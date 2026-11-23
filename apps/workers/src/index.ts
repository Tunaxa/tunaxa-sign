import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

import { startDocumentWorker } from "./document.worker";
import { startEmailWorker } from "./email.worker";
import { startWebhookWorker } from "./webhook.worker";
import { startAuditWorker } from "./audit.worker";
import { startCleanupWorker } from "./cleanup.worker";

async function main() {
  console.log("[Workers] Starting AXA Sign workers...");

  startDocumentWorker();
  startEmailWorker();
  startWebhookWorker();
  startAuditWorker();
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
