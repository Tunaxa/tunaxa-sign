import { Router } from "express";
import { requireOrganization } from "../../middleware/require-org";
import { OrganizationService } from "./organization.service";

const router = Router();
const service = new OrganizationService();

router.use(requireOrganization);

router.get("/profile", async (req, res, next) => {
  try {
    const profile = await service.getProfile(req.user!.organizationId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch("/settings", async (req, res, next) => {
  try {
    const org = await service.updateSettings(req.user!.organizationId, req.body);
    res.json(org);
  } catch (error) {
    next(error);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const stats = await service.getStats(req.user!.organizationId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export { router as organizationRoutes };
