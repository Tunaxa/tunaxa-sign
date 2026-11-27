ALTER TABLE "audit_events" ADD COLUMN "sequence" INTEGER;

UPDATE "audit_events" a
SET "sequence" = numbered."sequence"
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId"
    ORDER BY "createdAt", "id"
  ) AS "sequence"
  FROM "audit_events"
) numbered
WHERE a."id" = numbered."id";

DO $$
DECLARE
  unmatched TEXT;
BEGIN
  SELECT string_agg("id", '; ') INTO unmatched
  FROM "audit_events"
  WHERE "sequence" IS NULL;

  IF unmatched IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot backfill audit_events.sequence for rows: %', unmatched;
  END IF;
END $$;

ALTER TABLE "audit_events" ALTER COLUMN "sequence" SET NOT NULL;

CREATE UNIQUE INDEX "audit_events_organizationId_sequence_key"
  ON "audit_events"("organizationId", "sequence");
