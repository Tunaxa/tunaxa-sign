import { Router } from "express";
import { z } from "zod";
import { requireOrganization } from "../../middleware/require-org";
import { validate } from "../../middleware/validate";
import { AuditService } from "./audit.service";

const router = Router();
const service = new AuditService();

const AuditQuerySchema = z.object({
  contractId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.string().min(1).max(100).optional(),
});

router.use(requireOrganization);

router.get("/", validate(AuditQuerySchema, "query"), async (req, res, next) => {
  try {
    const { contractId, page, limit, type } = req.query as unknown as z.infer<
      typeof AuditQuerySchema
    >;

    if (contractId) {
      const result = await service.getContractAudit(
        req.user!.organizationId,
        contractId,
        { page, limit }
      );
      return res.json(result);
    }

    const result = await service.getOrganizationAudit(
      req.user!.organizationId,
      { page, limit, type }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as auditRoutes };
