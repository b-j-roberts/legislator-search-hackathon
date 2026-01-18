import { NextResponse } from "next/server";
import { checkPolSearchHealth } from "@/lib/polsearch";

export async function GET() {
  const polsearch = await checkPolSearchHealth();

  const overallStatus = polsearch.available ? "ok" : "degraded";

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      polsearch: {
        available: polsearch.available,
        latency: polsearch.latency,
        error: polsearch.error,
      },
    },
  });
}
