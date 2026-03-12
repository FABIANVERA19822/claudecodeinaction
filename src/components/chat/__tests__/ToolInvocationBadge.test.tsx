import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge, getToolLabel } from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

// getToolLabel unit tests

test("getToolLabel: str_replace_editor create with path", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/components/App.jsx" })).toBe("Creating App.jsx");
});

test("getToolLabel: str_replace_editor str_replace with path", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" })).toBe("Editing Card.jsx");
});

test("getToolLabel: str_replace_editor insert with path", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/lib/utils.ts" })).toBe("Editing utils.ts");
});

test("getToolLabel: str_replace_editor view with path", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/src/index.tsx" })).toBe("Reading index.tsx");
});

test("getToolLabel: str_replace_editor create without path", () => {
  expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating file");
});

test("getToolLabel: file_manager rename with path", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/components/Foo.jsx" })).toBe("Renaming Foo.jsx");
});

test("getToolLabel: file_manager delete with path", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/components/Bar.jsx" })).toBe("Deleting Bar.jsx");
});

test("getToolLabel: unknown tool returns raw tool name", () => {
  expect(getToolLabel("some_other_tool", {})).toBe("some_other_tool");
});

test("getToolLabel: str_replace_editor with no command returns raw tool name", () => {
  expect(getToolLabel("str_replace_editor", {})).toBe("str_replace_editor");
});

// ToolInvocationBadge component tests

test("ToolInvocationBadge renders label text", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "File created",
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("ToolInvocationBadge shows spinner when state is call", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      }}
    />
  );

  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolInvocationBadge shows green dot and no spinner when state is result", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/Card.jsx" },
        state: "result",
        result: "Done",
      }}
    />
  );

  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
