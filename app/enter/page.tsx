import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "TRIOZ — служебный вход",
  robots: { index: false, follow: false, nocache: true },
};

export default function EnterPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="site-shell grid min-h-screen items-center py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <a href="/" className="brand-mark text-text">TRIOZ</a>
            <p className="eyebrow mt-8">Private / Admin</p>
            <h1 className="type-h2 mt-3 text-text">Служебный вход.</h1>
            <p className="mt-4 type-body text-muted">Страница управления контентом, клиентами и проектами. Она не публикуется в навигации и закрыта для индексации.</p>
          </div>
          <LoginForm adminOnly />
        </div>
      </div>
    </main>
  );
}
