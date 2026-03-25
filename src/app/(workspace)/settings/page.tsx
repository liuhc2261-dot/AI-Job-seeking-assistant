import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { getSystemReadiness } from "@/lib/env";
import { commercialAccessService } from "@/services/commercial-access-service";

const securityRules = [
  "所有简历、版本、诊断与导出记录都必须显式带 user_id 约束，避免串数据。",
  "JD 优化、诊断应用和手动编辑默认沉淀为新版本，不直接覆盖母版。",
  "日志、错误提示和前端 toast 不暴露完整简历全文、密钥或完整 Prompt。",
];

const monitoringChecklist = [
  "补齐 OPENAI_API_KEY，并确认 OPENAI_TRIAL_MODEL 与 OPENAI_PAID_MODEL 配置正确。",
  "生产环境接入 Sentry 与 PostHog，至少验证注册、生成、优化、诊断、导出五条埋点链路。",
  "正式上线前把 PDF 存储切到 R2 或 S3，避免容器重启后文件丢失。",
];

const packageCards = [
  {
    title: "免费试用",
    price: "0 元",
    model: "GPT-5.1",
    perks: [
      "1 次母版生成",
      "1 次 JD 定制",
      "1 次诊断",
      "1 次 PDF 导出",
      "版本保存不限量",
    ],
  },
  {
    title: "29 元冲刺包",
    price: "29 元",
    model: "GPT-5.4",
    perks: [
      "10 次 JD 定制",
      "10 次诊断",
      "版本保存不限量",
      "导出不限量",
      "更强模型用于 AI 生成链路",
    ],
  },
] as const;

function formatActivatedAt(value: string | null) {
  if (!value) {
    return "未开通";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatOrderDate(value: string | null) {
  if (!value) {
    return "待确认";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAmount(amountCents: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

export default async function SettingsPage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [readiness, commercialProfile, orders] = await Promise.all([
    Promise.resolve(getSystemReadiness()),
    commercialAccessService.getCommercialProfileSummary(session.user.id),
    commercialAccessService.listOrders(session.user.id),
  ]);
  const recentOrders = orders.slice(0, 3);
  const quotaCards = [
    {
      label: "母版生成",
      value: `${commercialProfile.quotas.masterResumeCreditsRemaining} 次`,
      description: "首次建档后的 AI 母版简历生成次数。",
    },
    {
      label: "JD 定制",
      value: `${commercialProfile.quotas.jdTailorCreditsRemaining} 次`,
      description: "用于岗位定制链路的剩余次数。",
    },
    {
      label: "简历诊断",
      value: `${commercialProfile.quotas.diagnosisCreditsRemaining} 次`,
      description: "规则诊断 + AI 诊断的剩余次数。",
    },
    {
      label: "导出权益",
      value: commercialProfile.quotas.hasUnlimitedExports
        ? "不限量"
        : `${commercialProfile.quotas.pdfExportCreditsRemaining ?? 0} 次 PDF`,
      description: "Markdown 继续可导出，PDF 导出按权益控制。",
    },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Settings"
        title="套餐、模型与上线配置"
        description="这里把当前账号的商业化权益、模型路由和上线前要补齐的环境配置统一收口，方便我们边内测边收费。"
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="当前权益"
          description="当前账号的套餐、模型和核心剩余次数。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
              <p className="text-sm text-[color:var(--muted)]">当前套餐</p>
              <p className="mt-2 text-2xl font-semibold">{commercialProfile.planLabel}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                访问层级：{commercialProfile.accessTier === "paid" ? "付费用户" : "免费试用"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                生效时间：{formatActivatedAt(commercialProfile.activatedAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
              <p className="text-sm text-[color:var(--muted)]">当前模型</p>
              <p className="mt-2 text-2xl font-semibold">{commercialProfile.currentAiModel}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                当前套餐价格：{formatAmount(commercialProfile.amountCents)}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                模型路由会按 trial / paid 自动切换。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {quotaCards.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-4"
              >
                <p className="text-sm text-[color:var(--muted)]">{item.label}</p>
                <p className="mt-2 text-xl font-semibold">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="最近订单"
          description="便于核对内测期间的手动开通和续费记录。"
        >
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{order.planCode === "jd_diagnose_pack_29" ? "29 元冲刺包" : "免费试用"}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        渠道：{order.paymentChannel ?? "manual"} | 状态：{order.status}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {formatAmount(order.amountCents, order.currency)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    支付时间：{formatOrderDate(order.paidAt)}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    外部订单号：{order.externalOrderId ?? "未填写"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
              当前账号还没有付费订单。内测期间可以通过命令行脚本手动开通 29 元冲刺包。
            </div>
          )}
        </SectionCard>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {packageCards.map((card) => (
          <SectionCard
            key={card.title}
            title={card.title}
            description={`${card.price} · 默认模型 ${card.model}`}
          >
            <div className="space-y-2 text-sm leading-6 text-[color:var(--muted)]">
              {card.perks.map((perk) => (
                <p key={perk}>{perk}</p>
              ))}
            </div>
          </SectionCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="环境就绪度"
          description="内测收费前需要至少把这些环境变量和基础设施补齐。"
        >
          <div className="space-y-3">
            {readiness.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-[color:var(--muted)]">{item.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.configured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.configured ? "已配置" : "待配置"}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="上线前检查"
          description="先把商业化链路跑顺，再扩大投放。"
        >
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold">安全约束</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {securityRules.map((rule) => (
                  <p key={rule}>{rule}</p>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">监控清单</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {monitoringChecklist.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
