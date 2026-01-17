import { AppLayout } from "@/components/layout";
import { MessageSquare, Users } from "lucide-react";

export default function Home() {
  return (
    <AppLayout
      resultsPanel={
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-muted-foreground">
          <Users className="h-12 w-12 mb-4" />
          <h2 className="text-lg font-medium mb-2">Results Panel</h2>
          <p className="text-sm text-center max-w-xs">
            Legislator cards and search results will appear here
          </p>
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        {/* Chat Messages Area */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4" />
          <h2 className="text-lg font-medium mb-2">Chat Area</h2>
          <p className="text-sm text-center max-w-xs">
            Ask questions about legislators, hearings, and voting records
          </p>
        </div>

        {/* Chat Input Area (placeholder) */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm text-muted-foreground">
              Message input will go here...
            </div>
            <button
              disabled
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
