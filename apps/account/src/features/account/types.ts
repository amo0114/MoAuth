import { z } from "zod";

import {
  accountProfileSchema,
  accountSessionSchema,
  sessionListResponseSchema,
  accountUserSchema,
  activityEventSchema,
  authorizedApplicationSchema,
  securitySummarySchema,
  updateAccountProfileSchema,
} from "./schemas";

export type AccountUser = z.infer<typeof accountUserSchema>;
export type AccountProfile = z.infer<typeof accountProfileSchema>;
export type UpdateAccountProfileInput = z.infer<typeof updateAccountProfileSchema>;
export type SecuritySummary = z.infer<typeof securitySummarySchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountSessionList = z.infer<typeof sessionListResponseSchema>;
export type AuthorizedApplication = z.infer<typeof authorizedApplicationSchema>;
export type ActivityEvent = z.infer<typeof activityEventSchema>;
