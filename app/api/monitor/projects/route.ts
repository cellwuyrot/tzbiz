import {NextResponse} from "next/server";
import {monitoringActorProof} from "@/lib/auth";
import {monitoringRequest} from "@/lib/monitoring";
export async function GET(req:Request){try{const proof=await monitoringActorProof();if(!proof)return NextResponse.json({error:"Войдите в кабинет"},{status:401});const id=new URL(req.url).searchParams.get("projectId");return NextResponse.json(await monitoringRequest(proof,id?{action:"history",projectId:id}:{action:"projects"}),{headers:{"Cache-Control":"no-store"}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Мониторинг недоступен"},{status:503});}}
