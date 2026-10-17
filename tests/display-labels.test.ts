import { describe, it, expect } from "vitest";
import { renameDisplayText } from "@/lib/display-labels";
describe("display terminology", () => {
  it("renames display text without matching larger English identifiers", () => {
    expect(renameDisplayText("Premium/VPN, vpn и VPN-сервис")).toBe(
      "Premium/Надёжное соединение, Надёжное соединение и Надёжное соединение-сервис",
    );
    expect(renameDisplayText("VpnSubscription")).toBe("VpnSubscription");
  });
});
