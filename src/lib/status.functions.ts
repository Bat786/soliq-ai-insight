import { createServerFn } from "@tanstack/react-start";

import { collectDataStatus, type DataStatus } from "@/lib/status.server";

/** Public read: what every market data provider is serving right now. */
export const getDataStatus = createServerFn({ method: "GET" }).handler(async (): Promise<DataStatus> => {
  return collectDataStatus();
});
