import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { authenticate } from "@axa-sign/auth";
import { AuthService } from "./auth.service";

const router = Router();
const service = new AuthService();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(200),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

router.post("/register", validate(RegisterSchema), async (req, res, next) => {
  try {
    const result = await service.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(LoginSchema), async (req, res, next) => {
  try {
    const result = await service.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", validate(RefreshSchema), async (req, res, next) => {
  try {
    const result = await service.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const profile = await service.getProfile(req.user!.sub);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };
