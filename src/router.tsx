import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ApiError, isApiError } from "./lib/api/client";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Surface every failed mutation as a toast using the backend's own message.
    // Many actions (Kanban drags, sprint completion, brief generation) fire via
    // .mutate() with no local error handling, so without this a rejected action
    // fails silently -- the card just snaps back. This gives one consistent,
    // app-wide "why that didn't work" message.
    mutationCache: new MutationCache({
      onError: (error) => {
        // 401 is handled by the auth refresh/redirect flow, not a toast.
        if (isApiError(error) && error.status === 401) return;
        const message =
          isApiError(error) ? error.message : error instanceof Error ? error.message : "Something went wrong. Please try again.";
        toast.error(message);
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
