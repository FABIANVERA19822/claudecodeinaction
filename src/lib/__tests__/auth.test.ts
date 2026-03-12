// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

// Mock "server-only" so it doesn't throw in the test environment
vi.mock("server-only", () => ({}));

const TEST_SECRET = new TextEncoder().encode("development-secret-key");

// Shared mock cookie store — reset before each test
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession } = await import("@/lib/auth");

async function makeValidToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(TEST_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession

test("createSession sets an httpOnly cookie with a JWT", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // valid JWT structure
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

