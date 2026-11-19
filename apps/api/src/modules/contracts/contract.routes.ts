import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireOrganization } from "../../middleware/require-org";
import { ContractService } from "./contract.service";

const router = Router();
const service = new ContractService();

router.use(requireOrganization);

const CreateSchema = z.object({
  title: z.string().min(1).max(255),
  templateId: z.string().optional(),
  source: z.enum(["MANUAL", "TEMPLATE", "CRM", "API", "IMPORT"]).default("MANUAL"),
  expiresAt: z.coerce.date().optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  expiresAt: z.coerce.date().optional(),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

router.post("/", validate(CreateSchema), async (req, res, next) => {
  try {
    const contract = await service.create(
      req.user!.organizationId,
      req.user!.sub,
      req.body
    );
    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
});

router.get("/", validate(ListQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await service.list(req.user!.organizationId, req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const contract = await service.getById(req.user!.organizationId, req.params.id);
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", validate(UpdateSchema), async (req, res, next) => {
  try {
    const contract = await service.update(
      req.user!.organizationId,
      req.params.id as string,
      req.body
    );
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/send", async (req, res, next) => {
  try {
    const contract = await service.send(
      req.user!.organizationId,
      req.params.id as string,
      req.user!.sub
    );
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const contract = await service.cancel(
      req.user!.organizationId,
      req.params.id,
      req.user!.sub
    );
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/complete", async (req, res, next) => {
  try {
    const contract = await service.complete(req.user!.organizationId, req.params.id);
    res.json(contract);
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

export { router as contractRoutes };
