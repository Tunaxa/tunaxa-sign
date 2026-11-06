import { Router } from "express";
import { requireOrganization } from "../../middleware/require-org";
import { CertificateService } from "./certificate.service";

const router = Router();
const service = new CertificateService();

router.use(requireOrganization);

router.get("/contracts/:contractId", async (req, res, next) => {
  try {
    const certificate = await service.generateForContract(
      req.params.contractId,
      req.user!.organizationId
    );
    res.json(certificate);
  } catch (error) {
    next(error);
  }
});

router.get("/contracts/:contractId/download", async (req, res, next) => {
  try {
    const { buffer } = await service.download(
      req.params.contractId,
      req.user!.organizationId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${req.params.contractId}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router as certificateRoutes };