import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/jokester")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Laugh4.LoL" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});
