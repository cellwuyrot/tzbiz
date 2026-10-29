import crypto from "node:crypto";
import {openTzData} from "./tz-id/crypto";
type Proof={tzIssuer:string|null;tzSubject:string|null;tzAccessTokenEncrypted:string|null};
export async function monitoringRequest(session:Proof,input:Record<string,unknown>){
 if(process.env.PROJECT_MONITOR_ENABLED!=="1")throw Error("Мониторинг проектов пока не включён");
 if(session.tzIssuer!=="https://id.trioz.ru"||!session.tzSubject||!session.tzAccessTokenEncrypted)throw Error("Войдите через TZ ID");
 const client=process.env.TZ_ID_CLIENT_ID||"",secret=process.env.TZ_ID_CLIENT_SECRET||"";if(!client||!secret)throw Error("Не настроен серверный клиент");
 const body=JSON.stringify(input),stamp=String(Date.now()),nonce=crypto.randomUUID();const signature=crypto.createHmac("sha256",secret).update(["trioz-service-hub-v1",client,stamp,nonce,body].join("\n")).digest("hex");
 const r=await fetch("https://trioz.ru/api/integrations/project-monitor",{method:"POST",headers:{"Content-Type":"application/json","x-service-client":client,"x-service-time":stamp,"x-service-nonce":nonce,"x-service-signature":signature,"x-service-actor-token":openTzData<string>(session.tzAccessTokenEncrypted)},body,signal:AbortSignal.timeout(5000),cache:"no-store",redirect:"error"});
 if(!r.ok)throw Error("Не удалось получить мониторинг. Проверьте роль CONSULTANT и привязку проекта в TrioZ.");const data=await r.json();if(input.action!=="history"&&data.sub!==session.tzSubject)throw Error("Другой аккаунт");return data;
}
export async function readMonitoringRole(session:Proof):Promise<"CONSULTANT"|"CLIENT"> {if(process.env.PROJECT_MONITOR_ENABLED!=="1")return "CLIENT";try{return (await monitoringRequest(session,{action:"identity"})).role==="CONSULTANT"?"CONSULTANT":"CLIENT";}catch{return "CLIENT";}}
