import { z } from "zod";

const stringListSchema = z.array(z.string().trim().min(1).max(500)).min(1).max(30);

export const loginSchema = z.object({
  adminOnly: z.boolean().optional().default(false),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
});

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const clientUpdateSchema = clientCreateSchema.extend({
  id: z.string().cuid(),
});

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  projectUrl: z.string().url().refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }, "Project URL must use HTTP or HTTPS."),
  status: z.enum(["IN_PROGRESS", "DONE", "SUPPORT"]),
  isPublic: z.boolean(),
  clientId: z.string().cuid().nullable(),
});

export const projectIdSchema = z.object({ id: z.string().cuid() });

export const serviceSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(80),
  title: z.string().trim().min(1).max(160),
  shortDescription: z.string().trim().min(1).max(1000),
  fullDescription: z.string().trim().min(1).max(10000),
  includes: stringListSchema,
  stages: stringListSchema,
  sortOrder: z.number().int().min(0).max(100000),
  isPublished: z.boolean(),
});

export const serviceIdSchema = z.object({ id: z.string().cuid() });
export const mediaIdSchema = z.object({ id: z.string().cuid() });

export const siteSettingsSchema = z.object({
  tagline: z.string().trim().min(1).max(240),
  heroTitle: z.string().trim().min(1).max(200),
  heroSubtitle: z.string().trim().min(1).max(1500),
  contacts: z.string().trim().min(1).max(5000),
});


export const leadRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6).max(40),
  company: z.string().trim().max(160).default(""),
  serviceSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(80),
  message: z.string().trim().min(10).max(5000),
  privacyConsent: z.literal(true),
  website: z.string().max(0).optional().default(""),
});

export const leadIdSchema = z.object({ id: z.string().cuid() });
export const leadStatusSchema = z.enum(["NEW", "IN_PROGRESS", "DONE"]);
