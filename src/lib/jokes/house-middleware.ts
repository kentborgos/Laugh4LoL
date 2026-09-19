import { createMiddleware } from "@tanstack/react-start";

const HOUSE_TOKEN_KEY = "laugh_house";

export const houseMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let houseToken: string | undefined;
    try {
      houseToken = sessionStorage.getItem(HOUSE_TOKEN_KEY) ?? undefined;
    } catch {
      houseToken = undefined;
    }
    return next({ sendContext: { houseToken } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    assertSameSiteRequest();
    return next({ context: { houseToken: context.houseToken as string | undefined } });
  });

export function rememberHouseToken(token: string) {
  try {
    sessionStorage.setItem(HOUSE_TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}
