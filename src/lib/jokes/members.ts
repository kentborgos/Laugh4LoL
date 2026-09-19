import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { houseMiddleware } from "./house-middleware";
import { requireJokester } from "./jokester-lock.server";
import { listHouseMembers, memberHint, updateHouseMember } from "./members.server";

export const listMembers = createServerFn({ method: "GET" })
  .middleware([houseMiddleware])
  .handler(async ({ context }) => {
    requireJokester(context.houseToken);
    const rows = await listHouseMembers();
    return rows.map(memberHint);
  });

export const saveMember = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.string().min(1).max(80),
        name: z.string().min(1).max(80),
        ageVerified: z.boolean(),
        idType: z.enum(["", "state", "passport"]),
        idNumber: z.string().max(24),
        idJurisdiction: z.string().max(56),
        password: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .middleware([houseMiddleware])
  .handler(async ({ context, data }) => {
    requireJokester(context.houseToken);
    return memberHint(await updateHouseMember(data));
  });
