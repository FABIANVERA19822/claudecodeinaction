"use client";

import { Loader2 } from "lucide-react";
export function getToolLabel(toolName: string, args: any): string {
  const filename = args?.path ? args.path.split("/").pop() : null;

  if (toolName === "str_replace_editor") {
    switch (args?.command) {
      case "create":     return filename ? `Creating ${filename}`  : "Creating file";
      case "str_replace": return filename ? `Editing ${filename}` : "Editing file";
      case "insert":     return filename ? `Editing ${filename}`   : "Editing file";
      case "view":       return filename ? `Reading ${filename}`   : "Reading file";
    }
  }

  if (toolName === "file_manager") {
    switch (args?.command) {
      case "rename": return filename ? `Renaming ${filename}` : "Renaming file";
      case "delete": return filename ? `Deleting ${filename}` : "Deleting file";
    }
  }

  return toolName;
}

interface ToolInvocationBadgeProps {
  part: any;
}

export function ToolInvocationBadge({ part }: ToolInvocationBadgeProps) {
  const toolName = part.toolName ?? part.type?.replace(/^tool-/, "") ?? "tool";
  const label = getToolLabel(toolName, part.input ?? part.args);
  const isDone = part.state === "output-available" || part.state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200" suppressHydrationWarning>
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-neutral-700">{label}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{label}</span>
        </>
      )}
    </div>
  );
}
