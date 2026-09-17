import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { confirmEmailToken, sendVerificationEmail } from "./email.server";

export const requestVerificationEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => sendVerificationEmail(context.userId));

export const confirmVerification = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(input))
  .handler(async ({ data }) => confirmEmailToken(data.token));
