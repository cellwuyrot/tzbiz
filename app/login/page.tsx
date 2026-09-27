import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "TRIOZ — вход",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="site-shell grid min-h-screen items-center py-12">
        <div className="mx-auto w-full max-w-md">
          <p className="eyebrow">Private / Client</p>
          <h1 className="type-h2 mt-3 text-text">Доступ к проектам.</h1>
          <p className="mt-4 type-body text-muted">Вход для клиентов TRIOZ. Публичной ссылки на эту страницу нет.</p>
          <div className="mt-8"><LoginForm /></div>
        </div>
      </div>
    </main>
  );
}
