import Link from "next/link";
import { SessionInfo } from "@/components/session-info";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-neutral-900">Zeroichi ダッシュボード</h1>
        <p className="text-sm text-neutral-600">Supabase Auth とマルチテナント設定の検証用 UI です。ログイン状況とテナントコンテキストを表示します。</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-neutral-800">セッション情報</h2>
        <SessionInfo />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-neutral-800">操作リンク</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:text-neutral-900" href="/login">
            ログインページ
          </Link>
          <Link className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:text-neutral-900" href="/register">
            ユーザー登録ページ
          </Link>
        </div>
        <p className="text-xs text-neutral-500">ログイン後にこのページへ戻ると、JWT に含まれる tenant_id／ロール情報が表示されます。</p>
      </section>
    </div>
  );
}

