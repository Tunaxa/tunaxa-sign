import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { SigningService } from "./signing.service";

const router = Router();
const service = new SigningService();

const AuthenticateSchema = z.object({
  token: z.string(),
});

const SignSchema = z.object({
  token: z.string(),
  type: z.enum(["DRAWN", "TYPED", "UPLOADED"]),
  imageData: z.string().optional(),
  fieldX: z.number().optional(),
  fieldY: z.number().optional(),
  page: z.number().int().min(1).optional(),
});

router.get("/session/:token", async (req, res, next) => {
  try {
    const session = await service.getSession(req.params.token);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.get("/session/:token/document", async (req, res, next) => {
  try {
    const { buffer, document } = await service.getDocument(req.params.token as string);
    res.setHeader("Content-Type", document.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${document.name}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/session/authenticate", validate(AuthenticateSchema), async (req, res, next) => {
  try {
    const session = await service.authenticate(
      req.body.token,
      req.ip,
      req.headers["user-agent"]
    );
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/sign", validate(SignSchema), async (req, res, next) => {
  try {
    const signature = await service.sign(req.body.token, {
      type: req.body.type,
      imageData: req.body.imageData,
      fieldX: req.body.fieldX,
      fieldY: req.body.fieldY,
      page: req.body.page,
    });
    res.json(signature);
  } catch (error) {
    next(error);
  }
});

export { router as signingRoutes };
