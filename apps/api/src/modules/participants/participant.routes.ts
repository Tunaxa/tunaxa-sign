import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireOrganization } from "../../middleware/require-org";
import { ParticipantService } from "./participant.service";

const router = Router();
const service = new ParticipantService();

router.use(requireOrganization);

const AddSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  type: z.enum(["SIGNER", "APPROVER", "CC", "VIEWER"]).default("SIGNER"),
  role: z.string().optional(),
  signingOrder: z.number().int().min(0).default(0),
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  type: z.enum(["SIGNER", "APPROVER", "CC", "VIEWER"]).optional(),
  role: z.string().optional(),
  signingOrder: z.number().int().min(0).optional(),
});

router.post("/contracts/:contractId/participants", validate(AddSchema), async (req, res, next) => {
  try {
    const participant = await service.add(
      req.user!.organizationId,
      req.params.contractId as string,
      req.body
    );
    res.status(201).json(participant);
  } catch (error) {
    next(error);
  }
});

router.get("/contracts/:contractId/participants", async (req, res, next) => {
  try {
    const participants = await service.list(
      req.user!.organizationId,
      req.params.contractId
    );
    res.json(participants);
  } catch (error) {
    next(error);
  }
});

router.patch("/participants/:id", validate(UpdateSchema), async (req, res, next) => {
  try {
    const participant = await service.update(
      req.user!.organizationId,
      req.params.id as string,
      req.body
    );
    res.json(participant);
  } catch (error) {
    next(error);
  }
});

router.delete("/participants/:id", async (req, res, next) => {
  try {
    await service.remove(req.user!.organizationId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/participants/:id/remind", async (req, res, next) => {
  try {
    const result = await service.remind(req.user!.organizationId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as participantRoutes };
