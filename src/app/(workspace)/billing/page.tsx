import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { BillingCenter } from "@/features/commercial/components/billing-center";
import { commercialAccessService } from "@/services/commercial-access-service";

export default async function BillingPage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const overview = await commercialAccessService.getCommercialOverview(
    session.user.id,
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Billing"
        title="套餐中心与支付订单"
        description="这里负责试用转付费、订单跟踪和支付确认。先把商业化最小闭环跑通，再逐步扩展更多支付能力。"
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                当前套餐
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {overview.profile.planLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                AI 模型
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {overview.profile.currentAiModel}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                历史订单
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {overview.orders.length} 笔
              </p>
            </div>
          </div>
        }
      />

      <BillingCenter
        overview={overview}
        canMockConfirm={process.env.NODE_ENV !== "production"}
      />
    </div>
  );
}
