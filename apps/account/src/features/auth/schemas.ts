import { z } from "zod";

export const loginSchema = z.object({
  loginName: z.string().min(1, "请输入邮箱或用户名"),
  password: z.string().min(1, "请输入密码"),
});