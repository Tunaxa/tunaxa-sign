import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireOrganization } from "../../middleware/require-org";
import { WebhookService } from "./webhook.service";

const router = Router();
const service = new WebhookService();

router.use(requireOrganization);

const CreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

router.post("/endpoints", validate(CreateSchema), async (req, res, next) => {
  try {
    const endpoint = await service.createEndpoint(
      req.user!.organizationId,
      req.body.url,
      req.body.events
    );
    res.status(201).json(endpoint);
  } catch (error) {
    next(error);
  }
});

router.get("/endpoints", async (req, res, next) => {
  try {
    const endpoints = await service.listEndpoints(req.user!.organizationId);
    res.json(endpoints);
  } catch (error) {
    next(error);
  }
});

router.delete("/endpoints/:id", async (req, res, next) => {
  try {
    await service.deleteEndpoint(req.user!.organizationId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/endpoints/:id/deliveries", async (req, res, next) => {
  try {
    const deliveries = await service.getDeliveries(
      req.user!.organizationId,
      req.params.id
    );
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

export { router as webhookRoutes };
