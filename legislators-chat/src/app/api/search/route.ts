import { NextRequest, NextResponse } from "next/server";
import { polsearchFetch, PolSearchError } from "@/lib/polsearch";

export async function GET(request: NextRequest) {
  try {
    // Forward all query parameters unchanged
    const searchParams = request.nextUrl.searchParams.toString();
    const path = searchParams ? `/search?${searchParams}` : "/search";

    const response = await polsearchFetch(path);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PolSearch search error:", response.status, errorText);
      return NextResponse.json(
        { error: { code: "POLSEARCH_ERROR", message: "Search request failed" } },
        { status: response.status }
      );
    }

    // Return PolSearch response as-is
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Search API error:", error);

    if (error instanceof PolSearchError) {
      return NextResponse.json(
        { error: { code: "POLSEARCH_ERROR", message: error.message } },
        { status: error.status || 502 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An error occurred",
        },
      },
      { status: 500 }
    );
  }
}
