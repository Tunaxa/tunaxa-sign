import { Router } from "express";
import { authenticate } from "@axa-sign/auth";

import { authRoutes } from "./modules/auth/auth.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { apiKeyRoutes } from "./modules/api-keys/api-key.routes";
import { certificateRoutes } from "./modules/certificates/certificate.routes";
import { contractRoutes } from "./modules/contracts/contract.routes";
import { documentRoutes } from "./modules/documents/document.routes";
import { templateRoutes } from "./modules/templates/template.routes";
import { participantRoutes } from "./modules/participants/participant.routes";
import { signingRoutes } from "./modules/signing/signing.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import { webhookRoutes } from "./modules/webhooks/webhook.routes";
import { organizationRoutes } from "./modules/organizations/organization.routes";
import { userRoutes } from "./modules/users/user.routes";

const router = Router();

// ─── Public Routes ────────────────────────────────────
router.use("/auth", authRoutes);
router.use("/signing", signingRoutes);

// ─── Protected Routes ─────────────────────────────────
router.use(authenticate);

router.use("/admin", adminRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/organizations", organizationRoutes);
router.use("/users", userRoutes);
router.use("/contracts", contractRoutes);
router.use("/documents", documentRoutes);
router.use("/templates", templateRoutes);
router.use("/participants", participantRoutes);
router.use("/audit", auditRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/certificates", certificateRoutes);

export { router as routes };
