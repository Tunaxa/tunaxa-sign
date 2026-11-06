import { Router } from "express";
import { requireOrganization } from "../../middleware/require-org";
import { AuditService } from "./audit.service";

const router = Router();
const service = new AuditService();

router.use(requireOrganization);

router.get("/contracts/:contractId", async (req, res, next) => {
  try {
    const result = await service.getContractAudit(
      req.user!.organizationId,
      req.params.contractId,
      req.query as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await service.getOrganizationAudit(
      req.user!.organizationId,
      req.query as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as auditRoutes };
