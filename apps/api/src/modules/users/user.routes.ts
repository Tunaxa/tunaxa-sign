import { Router } from "express";
import { requireOrganization } from "../../middleware/require-org";
import { requireRole } from "@axa-sign/auth";
import { UserService } from "./user.service";

const router = Router();
const service = new UserService();

router.use(requireOrganization);

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
    const user = await service.getById(req.user!.organizationId, req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/role", requireRole("OWNER", "ADMIN"), async (req, res, next) => {
  try {
    const user = await service.updateRole(
      req.user!.organizationId,
      req.params.id as string,
      req.body.role
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };
