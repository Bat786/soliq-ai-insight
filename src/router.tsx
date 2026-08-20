import "@/lib/node-globals";

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { installChunkRecovery } from "@/lib/chunk-recovery";
import { routeTree } from "./routeTree.gen";

installChunkRecovery();


export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
