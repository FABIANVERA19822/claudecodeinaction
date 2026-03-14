import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

/**
 * Marks the last message before the current user input with cache_control.
 * This caches the full conversation history so each new turn reuses prior context
 * without reprocessing it (saves ~90% of input token costs on long conversations).
 *
 * Cache hierarchy: system (already marked) → conversation history → current user msg
 *
 *   [system ✓] [user1] [assistant1] [user2] [assistant2 ✓] [user3 ← current, not cached]
 */
function applyConversationCache(messages: any[]): any[] {
  // Need at least: system + 1 prior turn + current user message
  if (messages.length < 3) return messages;

  const result = [...messages];
  const targetIdx = result.length - 2; // last message before current user input

  // Guard: never modify the system message
  if (result[targetIdx].role === "system") return result;

  const target = { ...result[targetIdx] };
  const cacheProviderOptions = {
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  if (typeof target.content === "string") {
    // Convert string content to block array so we can attach cache_control
    target.content = [{ type: "text", text: target.content, ...cacheProviderOptions }];
  } else if (Array.isArray(target.content) && target.content.length > 0) {
    const newContent = [...target.content];
    newContent[newContent.length - 1] = {
      ...newContent[newContent.length - 1],
      ...cacheProviderOptions,
    };
    target.content = newContent;
  }

  result[targetIdx] = target;
  return result;
}

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  // Convert UIMessages (from @ai-sdk/react v3) to CoreMessages (expected by streamText)
  const coreMessages = await convertToModelMessages(messages);

  const systemMessage = {
    role: "system" as const,
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  const allMessages = [systemMessage, ...coreMessages];
  const cachedMessages = applyConversationCache(allMessages);

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  const model = getLanguageModel();
  // Use fewer steps for mock provider to prevent repetition
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;
  const result = streamText({
    model: model as any,
    messages: cachedMessages,
    maxOutputTokens: 10_000,
    stopWhen: stepCountIs(isMockProvider ? 4 : 40),
    onError: (err: any) => {
      console.error(err);
    },
    tools: {
      str_replace_editor: buildStrReplaceTool(fileSystem),
      file_manager: buildFileManagerTool(fileSystem),
    },
    onFinish: async ({ response, usage, steps, providerMetadata }) => {
      // Aggregate cache metrics across all steps (each step = one Anthropic API call)
      // Also include the last step's providerMetadata from the event itself
      const allSteps = [...(steps as any[]), { providerMetadata }];
      let totalCacheWrite = 0;
      let totalCacheRead = 0;
      for (const step of allSteps) {
        const meta = step.providerMetadata?.anthropic as any;
        totalCacheWrite += meta?.cacheCreationInputTokens ?? 0;
        totalCacheRead += meta?.cacheReadInputTokens ?? 0;
      }

      console.log("[prompt-cache]", {
        write: totalCacheWrite,
        read: totalCacheRead,
        input: usage.inputTokens,
        output: usage.outputTokens,
        steps: allSteps.length,
      });
      // Save to project if projectId is provided and user is authenticated
      if (projectId) {
        try {
          // Check if user is authenticated
          const session = await getSession();
          if (!session) {
            console.error("User not authenticated, cannot save project");
            return;
          }

          const allMessages = [
            ...coreMessages,
            ...(response.messages || []),
          ];

          await prisma.project.update({
            where: {
              id: projectId,
              userId: session.userId,
            },
            data: {
              messages: JSON.stringify(allMessages),
              data: JSON.stringify(fileSystem.serialize()),
            },
          });
        } catch (error) {
          console.error("Failed to save project data:", error);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return { files: fileSystem.serialize() };
      }
      return undefined;
    },
  });
}

export const maxDuration = 120;
