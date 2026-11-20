ALTER TABLE "documents" ADD COLUMN "organizationId" TEXT;

DO $$
DECLARE
  conflicts TEXT;
BEGIN
  WITH candidates AS (
    SELECT d."id" AS document_id, c."organizationId" AS org_id
    FROM "documents" d
    JOIN "contract_versions" cv ON cv."documentId" = d."id"
    JOIN "contracts" c ON c."id" = cv."contractId"
    UNION
    SELECT d."id", t."organizationId"
    FROM "documents" d
    JOIN "template_versions" tv ON tv."documentId" = d."id"
    JOIN "templates" t ON t."id" = tv."templateId"
    UNION
    SELECT d."id", o."id"
    FROM "documents" d
    JOIN "organizations" o ON o."id" = split_part(d."storageKey", '/', 2)
    WHERE split_part(d."storageKey", '/', 1) IN ('original', 'templates', 'signed', 'certificates')
      AND split_part(d."storageKey", '/', 2) <> ''
  )
  SELECT string_agg(format('document=%s orgs=%s', document_id, org_ids), '; ')
  INTO conflicts
  FROM (
    SELECT document_id, string_agg(DISTINCT org_id, ',') AS org_ids
    FROM candidates
    GROUP BY document_id
    HAVING count(DISTINCT org_id) > 1
  ) conflicting;

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting organization sources for documents: %', conflicts;
  END IF;
END $$;

UPDATE "documents" d
SET "organizationId" = c."organizationId"
FROM "contract_versions" cv
JOIN "contracts" c ON c."id" = cv."contractId"
WHERE cv."documentId" = d."id"
  AND d."organizationId" IS NULL;

UPDATE "documents" d
SET "organizationId" = t."organizationId"
FROM "template_versions" tv
JOIN "templates" t ON t."id" = tv."templateId"
WHERE tv."documentId" = d."id"
  AND d."organizationId" IS NULL;

UPDATE "documents" d
SET "organizationId" = o."id"
FROM "organizations" o
WHERE d."organizationId" IS NULL
  AND split_part(d."storageKey", '/', 1) IN ('original', 'templates', 'signed', 'certificates')
  AND split_part(d."storageKey", '/', 2) = o."id";

DO $$
DECLARE
  unmatched TEXT;
BEGIN
  SELECT string_agg(format('id=%s storageKey=%s', "id", "storageKey"), '; ')
  INTO unmatched
  FROM "documents"
  WHERE "organizationId" IS NULL;

  IF unmatched IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot backfill documents.organizationId for rows: %', unmatched;
  END IF;
END $$;

ALTER TABLE "documents" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
