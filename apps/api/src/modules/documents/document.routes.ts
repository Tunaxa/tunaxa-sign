import { Router } from "express";
import multer from "multer";
import { requireOrganization } from "../../middleware/require-org";
import { DocumentService } from "./document.service";

const router = Router();
const service = new DocumentService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireOrganization);

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    const document = await service.upload(
      req.user!.organizationId,
      req.file,
      req.body.contractId
    );
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const document = await service.getById(req.params.id);
    res.json(document);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const { buffer, document } = await service.download(req.params.id);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.name}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await service.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as documentRoutes };
