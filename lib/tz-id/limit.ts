import type { NextRequest } from "next/server";
import { consumeRate, requestIp } from "../rate-limit";
export async function allowTzLoginStart(request: NextRequest) {
  return (await consumeRate("tz-login", requestIp(request), 10, 600_000))
    .allowed;
}
