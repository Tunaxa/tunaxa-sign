import { Router } from "express";
import { authenticate } from "@axa-sign/auth";
import { AdminService } from "./admin.service";

const router = Router();

// All admin routes require authentication + platform admin role
router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user?.role !== "OWNER" || !req.user?.organizationId) {
    return next(new (require("@axa-sign/shared").ForbiddenError)("Platform admin access required"));
  }
  next();
});

router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await AdminService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/organizations", async (_req, res, next) => {
  try {
    const orgs = await AdminService.getOrganizations();
    res.json({ data: orgs });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await AdminService.getUsers();
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});

router.get("/audit-events", async (_req, res, next) => {
  try {
    const events = await AdminService.getAuditEvents();
    res.json({ data: events });
  } catch (error) {
    next(error);
  }
});

router.get("/queues", async (_req, res, next) => {
  try {
    const queues = await AdminService.getQueueStatus();
    res.json({ data: queues });
  } catch (error) {
    next(error);
  }
});

router.get("/health", async (_req, res, next) => {
  try {
    const health = await AdminService.getHealth();
    res.json({ data: health });
  } catch (error) {
    next(error);
  }
});

router.get("/storage", async (_req, res, next) => {
  try {
    const storage = await AdminService.getStorageInfo();
    res.json({ data: storage });
  } catch (error) {
    next(error);
  }
});

router.get("/certificates", async (_req, res, next) => {
  try {
    const certs = await AdminService.getCertificates();
    res.json({ data: certs });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };