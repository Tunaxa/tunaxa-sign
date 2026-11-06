import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireOrganization } from "../../middleware/require-org";
import { ApiKeyService } from "./api-key.service";

const router = Router();
const service = new ApiKeyService();

router.use(requireOrganization);

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z
    .array(z.enum([
      "contracts.read",
      "contracts.write",
      "contracts.send",
      "documents.read",
      "templates.read",
      "templates.write",
      "webhooks.manage",
      "audit.read",
    ]))
    .default([]),
  expiresAt: z.coerce.date().optional(),
});

router.post("/", validate(CreateSchema), async (req, res, next) => {
  try {
    const result = await service.create(
      req.user!.organizationId,
      req.body.name,
      req.body.permissions,
      req.body.expiresAt
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const keys = await service.list(req.user!.organizationId);
    res.json(keys);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/revoke", async (req, res, next) => {
  try {
    const key = await service.revoke(req.user!.organizationId, req.params.id);
    res.json(key);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await service.delete(req.user!.organizationId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as apiKeyRoutes };