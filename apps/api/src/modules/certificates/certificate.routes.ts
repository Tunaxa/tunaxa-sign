import { Router } from "express";
import { requireOrganization } from "../../middleware/require-org";
import { sendPdfAttachment } from "../../middleware/pdf-response";
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
    const { buffer, certificate } = await service.download(
      req.params.contractId,
      req.user!.organizationId
    );
    sendPdfAttachment(res, buffer, `certificate-${certificate.subject}.pdf`);
  } catch (error) {
    next(error);
  }
});

export { router as certificateRoutes };