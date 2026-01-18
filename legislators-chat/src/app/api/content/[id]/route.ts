import { NextRequest, NextResponse } from "next/server";
import { polsearchFetch, PolSearchError } from "@/lib/polsearch";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Content ID is required" } },
        { status: 400 }
      );
    }

    // Forward any additional query parameters
    const searchParams = request.nextUrl.searchParams.toString();
    const path = searchParams
      ? `/content/${encodeURIComponent(id)}?${searchParams}`
      : `/content/${encodeURIComponent(id)}`;

    const response = await polsearchFetch(path);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Content not found" } },
          { status: 404 }
        );
      }

      const errorText = await response.text();
      console.error("PolSearch content error:", response.status, errorText);
      return NextResponse.json(
        { error: { code: "POLSEARCH_ERROR", message: "Content request failed" } },
        { status: response.status }
      );
    }

    // Return PolSearch response as-is
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Content API error:", error);

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
