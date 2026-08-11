import { createServerFn } from "@tanstack/react-start";

export const getWhaleFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWhaleFeed } = await import("@/lib/unusual-whales.server");
  return loadWhaleFeed();
});
