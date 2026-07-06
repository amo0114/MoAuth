import { z } from "zod";

import { loginSchema } from "./schemas";

export type LoginFormValues = z.infer<typeof loginSchema>;

export interface LoginExistingUser {
  sub: string;
  loginName: string;
  email?: string;
}