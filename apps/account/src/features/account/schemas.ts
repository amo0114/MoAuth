import { z } from "zod";

export const accountUserSchema = z.object({
  sub: z.string(),
  loginName: z.string(),
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

export const accountMeResponseSchema = z.object({
  status: z.string(),
  user: accountUserSchema,
});

export const accountProfileSchema = z.object({
  sub: z.string().optional(),
  loginName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  emailVerified: z.boolean().optional(),
  displayName: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});

export const accountProfileResponseSchema = z.object({
  status: z.string(),
  profile: accountProfileSchema,
});

export const updateAccountProfileSchema = z.object({
  displayName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const securitySummarySchema = z.object({
  status: z.string(),
  password: z.object({ set: z.boolean() }),
  mfa: z.object({
    enabled: z.boolean(),
    methods: z.array(z.string()).optional(),
  }),
  passkeys: z.object({
    count: z.number(),
    items: z.array(z.unknown()).optional(),
  }),
});

export const accountSessionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  current: z.boolean(),
  createdAt: z.union([z.string(), z.number(), z.date()]),
  lastSeenAt: z.union([z.string(), z.number(), z.date()]).optional(),
  expiresAt: z.union([z.string(), z.number(), z.date()]).optional(),
});

export const sessionListResponseSchema = z.object({
  status: z.string(),
  sessions: z.array(accountSessionSchema),
});

export const authorizedApplicationSchema = z.object({
  clientId: z.string(),
  displayName: z.string(),
  scopes: z.array(z.string()),
  grantedAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
  status: z.string(),
  source: z.string().optional(),
});

export const applicationListResponseSchema = z.object({
  status: z.string(),
  applications: z.array(authorizedApplicationSchema),
});

export const activityEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  summary: z.string(),
  createdAt: z.union([z.string(), z.number(), z.date()]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const activityListResponseSchema = z.object({
  status: z.string(),
  events: z.array(activityEventSchema),
});