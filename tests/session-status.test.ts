import {beforeEach,afterEach,it,expect,vi} from "vitest";
vi.mock("@/lib/tz-id/project-role",()=>({readTzProjectRole:vi.fn(async()=>"CLIENT")}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>({value:"synthetic-session"})})}));
vi.mock("@/lib/db",()=>({prisma:{session:{findUnique:vi.fn(),delete:vi.fn(),deleteMany:vi.fn()}}}));
vi.mock("@/lib/tz-id/client",()=>({isActiveTzSession:vi.fn()}));
import {prisma} from "@/lib/db";
import {isActiveTzSession} from "@/lib/tz-id/client";
import {readTzProjectRole} from "@/lib/tz-id/project-role";
import {getCurrentUser} from "@/lib/auth";
beforeEach(()=>{vi.resetAllMocks();vi.mocked(readTzProjectRole).mockResolvedValue("CLIENT");vi.stubEnv("SESSION_SECRET","synthetic-test-secret-at-least-32-chars");vi.mocked(prisma.session.findUnique).mockResolvedValue({id:"session",tzIssuer:"https://id.trioz.ru",tzSubject:"central-user",tzAccessTokenEncrypted:"sealed-token",expiresAt:new Date(Date.now()+60_000),user:{id:"user"}} as never);vi.mocked(prisma.session.deleteMany).mockResolvedValue({count:1});vi.mocked(prisma.session.delete).mockResolvedValue({} as never);});
afterEach(()=>vi.unstubAllEnvs());
it("fails closed but preserves the session on introspection outage",async()=>{vi.mocked(isActiveTzSession).mockResolvedValue(null);expect(await getCurrentUser()).toBe(null);expect(prisma.session.deleteMany).not.toHaveBeenCalled();});
it("deletes a revoked or mismatching identity",async()=>{vi.mocked(isActiveTzSession).mockResolvedValue(false);expect(await getCurrentUser()).toBe(null);expect(prisma.session.deleteMany).toHaveBeenCalled();});
it("allows only verified active sessions",async()=>{vi.mocked(isActiveTzSession).mockResolvedValue(true);expect(await getCurrentUser()).toMatchObject({id:"user"});});

it("does not retain a local ADMIN role when a central project grant is revoked",async()=>{
 vi.mocked(prisma.session.findUnique).mockResolvedValue({id:"s",tzIssuer:"https://id.trioz.ru",tzSubject:"central-user",tzAccessTokenEncrypted:"sealed-token",expiresAt:new Date(Date.now()+60000),user:{id:"user",role:"ADMIN"}} as never);
 vi.mocked(isActiveTzSession).mockResolvedValue(true);
 expect(await getCurrentUser()).toMatchObject({role:"CLIENT"});
 vi.mocked(readTzProjectRole).mockResolvedValue("ADMIN");expect(await getCurrentUser()).toMatchObject({role:"ADMIN"});
 vi.mocked(readTzProjectRole).mockResolvedValue("CLIENT");expect(await getCurrentUser()).toMatchObject({role:"CLIENT"});
});
it("rejects password-era admin sessions even with a local ADMIN role",async()=>{
 vi.mocked(prisma.session.findUnique).mockResolvedValue({id:"s",tzIssuer:null,expiresAt:new Date(Date.now()+60000),user:{id:"admin",role:"ADMIN"}} as never);
 expect(await getCurrentUser()).toBeNull();expect(readTzProjectRole).not.toHaveBeenCalled();
});
