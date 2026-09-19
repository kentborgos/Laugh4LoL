import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Laugh4.LoL" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/jokester" });
  },
  component: () => null,
});
