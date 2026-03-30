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
        description="这里负责试用转付费、订单跟踪和支付确认。先把商业化最小闭环跑通，后续再扩展更多支付能力。"
      />

      <BillingCenter
        overview={overview}
        canMockConfirm={process.env.NODE_ENV !== "production"}
      />
    </div>
  );
}
