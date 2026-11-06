import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireOrganization } from "../../middleware/require-org";
import { TemplateService } from "./template.service";
import { TemplateEngine } from "./template-engine.service";

const router = Router();
const service = new TemplateService();
const engine = new TemplateEngine();

router.use(requireOrganization);

const GenerateSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.string()).default({}),
  participants: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        type: z.enum(["SIGNER", "APPROVER", "CC", "VIEWER"]).default("SIGNER"),
        role: z.string().optional(),
        signingOrder: z.number().int().min(0).default(0),
      })
    )
    .min(1),
  options: z.object({
    title: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
  }).optional(),
});

// Must be registered BEFORE /:id routes
router.post("/generate", validate(GenerateSchema), async (req, res, next) => {
  try {
    const result = await engine.generateContractFromTemplate(
      req.user!.organizationId,
      req.user!.sub,
      req.body.templateId,
      req.body.variables,
      req.body.participants,
      req.body.options
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

const CreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
});

const FieldSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["SIGNATURE", "INITIAL", "DATE", "TEXT", "CHECKBOX", "DROPDOWN", "NUMBER", "EMAIL", "PHONE"]),
  required: z.boolean().default(true),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(10),
  height: z.number().min(10),
  page: z.number().int().min(1).default(1),
  roleId: z.string().optional(),
  config: z.record(z.unknown()).default({}),
});

router.post("/", validate(CreateSchema), async (req, res, next) => {
  try {
    const template = await service.create(req.user!.organizationId, req.body);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await service.list(req.user!.organizationId, req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const template = await service.getById(req.user!.organizationId, req.params.id);
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/fields", validate(FieldSchema), async (req, res, next) => {
  try {
    const field = await service.addField(
      req.user!.organizationId,
      req.params.id as string,
      req.body
    );
    res.status(201).json(field);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/roles", async (req, res, next) => {
  try {
    const role = await service.addRole(
      req.user!.organizationId,
      req.params.id,
      req.body.name
    );
    res.status(201).json(role);
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

export { router as templateRoutes };
