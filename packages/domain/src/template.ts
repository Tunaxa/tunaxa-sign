import { z } from "zod";

export const FieldType = z.enum([
  "SIGNATURE",
  "INITIAL",
  "DATE",
  "TEXT",
  "CHECKBOX",
  "DROPDOWN",
  "NUMBER",
  "EMAIL",
  "PHONE",
]);
export type FieldType = z.infer<typeof FieldType>;

export interface Template {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateField {
  id: string;
  templateId: string;
  name: string;
  type: FieldType;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  roleId?: string;
  config: Record<string, unknown>;
}

export interface TemplateRole {
  id: string;
  templateId: string;
  name: string;
}

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
});

export const CreateTemplateFieldSchema = z.object({
  name: z.string().min(1).max(255),
  type: FieldType,
  required: z.boolean().default(true),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(10),
  height: z.number().min(10),
  page: z.number().int().min(1).default(1),
  roleId: z.string().optional(),
  config: z.record(z.unknown()).default({}),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type CreateTemplateFieldInput = z.infer<typeof CreateTemplateFieldSchema>;
