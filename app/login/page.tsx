import { redirect } from "next/navigation";
export const metadata = { title: "Вход через TZ ID", robots: { index: false, follow: false } };
export default function Login() { redirect("/account"); }
