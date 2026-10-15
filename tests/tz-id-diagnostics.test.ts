import { afterEach, expect, it, vi } from "vitest";
import { logTzCallbackFailure, tzCallbackReason } from "@/lib/tz-id/diagnostics";
afterEach(() => vi.restoreAllMocks());
it.each([
 [new Error("Missing transaction"), "TRANSACTION_COOKIE_MISSING"],
 [new Error("Explicit account linking required"), "EXPLICIT_LINK_REQUIRED"],
 [new Error("Verified email required"), "VERIFIED_EMAIL_REQUIRED"],
 [{ code: "P2021" }, "DATABASE_TABLE_MISSING"],
 [{ code: "P2022" }, "DATABASE_COLUMN_MISSING"],
 [{ error: "invalid_scope" }, "invalid_scope"],
 [{ error: "invalid_client" }, "invalid_client"],
 [{ cause: { error: "invalid_grant" } }, "invalid_grant"],
 [{ code: "OAUTH_JWT_CLAIM_COMPARISON_FAILED" }, "OAUTH_JWT_CLAIM_COMPARISON_FAILED"],
 [new Error("token=private email=private@example.invalid"), "REJECTED"],
 [{ code: "private-token-value", cause: { error: "private-email" } }, "REJECTED"],
 [null, "REJECTED"],
])("logs only a fixed reason: %#", (error, expected) => expect(tzCallbackReason(error)).toBe(expected));
it("never logs error objects, messages, URLs or secrets", () => {
 const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
 logTzCallbackFailure("code_exchange", { error: "invalid_client", message: "private-secret", token: "private-token", url: "https://example.invalid/?code=private-code" });
 expect(warn).toHaveBeenCalledExactlyOnceWith("[tz-id] callback_failed", { stage: "code_exchange", reason: "invalid_client" });
 expect(JSON.stringify(warn.mock.calls)).not.toContain("private-");
});
