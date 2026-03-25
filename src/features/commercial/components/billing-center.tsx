"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SectionCard } from "@/components/section-card";
import { paymentChannelLabels } from "@/lib/commercial";
import {
  captureAnalyticsEvent,
  telemetryEvents,
} from "@/lib/telemetry/client";
import type {
  CommerceOverview,
  CommerceOrderSummary,
  CommercePaymentChannelKind,
  CommercePlanSummary,
} from "@/types/commercial";

type BillingCenterProps = {
  overview: CommerceOverview;
  canMockConfirm: boolean;
};

const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";

function formatAmount(amountCents: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatTime(value: string | null) {
  if (!value) {
    return "待支付";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readApiPayload<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | {
        success: true;
        data: T;
      }
    | {
        success: false;
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload && !payload.success
        ? payload.error?.message ?? "请求失败，请稍后重试。"
        : "请求失败，请稍后重试。",
    );
  }

  return payload.data;
}

function buildPlanPerks(plan: CommercePlanSummary) {
  const perks = [];

  if (plan.masterResumeCredits > 0) {
    perks.push(`${plan.masterResumeCredits} 次母版生成`);
  }

  if (plan.jdTailorCredits > 0) {
    perks.push(`${plan.jdTailorCredits} 次 JD 定制`);
  }

  if (plan.diagnosisCredits > 0) {
    perks.push(`${plan.diagnosisCredits} 次简历诊断`);
  }

  if (plan.hasUnlimitedExports) {
    perks.push("导出不限量");
  } else if (plan.pdfExportCredits) {
    perks.push(`${plan.pdfExportCredits} 次 PDF 导出`);
  }

  perks.push(`默认模型 ${plan.currentAiModel}`);

  return perks;
}

function getOrderStatusLabel(order: CommerceOrderSummary) {
  switch (order.status) {
    case "pending":
      return "待支付";
    case "paid":
      return "已支付";
    case "manual_granted":
      return "人工开通";
    case "cancelled":
      return "已取消";
    case "refunded":
      return "已退款";
    default:
      return order.status;
  }
}

function getPaymentChannelLabel(value: string | null) {
  if (!value) {
    return "未指定";
  }

  return (
    paymentChannelLabels[value as CommercePaymentChannelKind] ??
    value
  );
}

function getLatestPendingOrder(orders: CommerceOrderSummary[]) {
  return orders.find((order) => order.status === "pending") ?? null;
}

export function BillingCenter({ overview, canMockConfirm }: BillingCenterProps) {
  const router = useRouter();
  const [selectedChannel, setSelectedChannel] =
    useState<CommercePaymentChannelKind>("wechat");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingOrder, startCreateTransition] = useTransition();
  const [isConfirmingOrder, startConfirmTransition] = useTransition();

  const pendingOrder = useMemo(
    () => getLatestPendingOrder(overview.orders),
    [overview.orders],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="当前账号权益"
          description="这里会实时反映当前套餐、模型和剩余次数。订单支付完成后刷新即可到账。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
              <p className="text-sm text-[color:var(--muted)]">当前套餐</p>
              <p className="mt-2 text-2xl font-semibold">{overview.profile.planLabel}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                当前模型：{overview.profile.currentAiModel}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                开通时间：{formatTime(overview.profile.activatedAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
              <p className="text-sm text-[color:var(--muted)]">剩余次数</p>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <p>母版生成：{overview.profile.quotas.masterResumeCreditsRemaining} 次</p>
                <p>JD 定制：{overview.profile.quotas.jdTailorCreditsRemaining} 次</p>
                <p>简历诊断：{overview.profile.quotas.diagnosisCreditsRemaining} 次</p>
                <p>
                  导出权益：
                  {overview.profile.quotas.hasUnlimitedExports
                    ? " 不限量"
                    : ` ${overview.profile.quotas.pdfExportCreditsRemaining ?? 0} 次 PDF`}
                </p>
              </div>
            </div>
          </div>

          {(notice || error) ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                error
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error ?? notice}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="支付方式"
          description="当前先走轻量内测收费流程：用户创建订单，回调或人工确认后自动发放权益。"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              Object.entries(paymentChannelLabels) as Array<
                [CommercePaymentChannelKind, string]
              >
            ).map(([channel, label]) => {
              const selected = selectedChannel === channel;

              return (
                <button
                  key={channel}
                  type="button"
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel);
                    setNotice(null);
                    setError(null);
                  }}
                >
                  <p className="font-medium">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {channel === "manual"
                      ? "适合内测阶段手动开通和客服代操作。"
                      : "创建订单后保留订单号，后续由支付回调自动确认。"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            <p>当前策略：免费试用走 GPT-5.1，29 元冲刺包走 GPT-5.4。</p>
            <p>如果支付网关还没接完，运营也可以先通过回调接口或命令行脚本完成开通。</p>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {overview.plans.map((plan) => {
          const perks = buildPlanPerks(plan);
          const isCurrentPlan = overview.profile.planCode === plan.code;
          const isTrial = plan.code === "trial";

          return (
            <SectionCard
              key={plan.code}
              title={plan.label}
              description={`${formatAmount(plan.amountCents)} · ${plan.currentAiModel}`}
            >
              <div className="space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {perks.map((perk) => (
                  <p key={perk}>{perk}</p>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {isTrial ? (
                  <span className="inline-flex rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-medium text-[color:var(--muted)]">
                    {isCurrentPlan ? "当前试用中" : "默认套餐"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={isCreatingOrder}
                    onClick={() => {
                      setNotice(null);
                      setError(null);

                      startCreateTransition(async () => {
                        try {
                          const result = await readApiPayload<{
                            order: CommerceOrderSummary;
                            reusedExistingOrder: boolean;
                          }>(
                            await fetch("/api/commerce/checkout", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                planCode: plan.code,
                                paymentChannel: selectedChannel,
                              }),
                            }),
                          );

                          captureAnalyticsEvent(telemetryEvents.checkoutStarted, {
                            planCode: plan.code,
                            paymentChannel: selectedChannel,
                            reusedExistingOrder: result.reusedExistingOrder,
                          });
                          setNotice(
                            result.reusedExistingOrder
                              ? "已复用你当前未支付的订单，继续完成支付即可。"
                              : "支付订单已创建，完成支付后权益会自动到账。",
                          );
                          router.refresh();
                        } catch (requestError) {
                          setError(
                            requestError instanceof Error
                              ? requestError.message
                              : "创建支付订单失败，请稍后重试。",
                          );
                        }
                      });
                    }}
                  >
                    {isCreatingOrder
                      ? "创建中..."
                      : pendingOrder
                        ? "继续当前订单"
                        : isCurrentPlan
                          ? "续费 29 元套餐"
                          : "开通 29 元套餐"}
                  </button>
                )}
              </div>
            </SectionCard>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="当前待支付订单"
          description="创建订单后，这里会保留订单号、金额和确认步骤。"
        >
          {pendingOrder ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
                <p className="text-sm text-[color:var(--muted)]">订单号</p>
                <p className="mt-2 break-all font-mono text-sm">{pendingOrder.id}</p>
                <p className="mt-3 text-sm text-[color:var(--muted)]">
                  套餐：{pendingOrder.planCode === "jd_diagnose_pack_29" ? "29 元冲刺包" : "免费试用"}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  金额：{formatAmount(pendingOrder.amountCents, pendingOrder.currency)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  渠道：{getPaymentChannelLabel(pendingOrder.paymentChannel)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  创建时间：{formatTime(pendingOrder.createdAt)}
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                <p>1. 用户根据订单号完成转账或扫码支付。</p>
                <p>2. 支付平台回调 `/api/commerce/orders/{pendingOrder.id}/confirm`。</p>
                <p>3. 回调成功后自动切换到付费模型并发放 10 次 JD 定制、10 次诊断和无限导出。</p>
              </div>

              {canMockConfirm ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={isConfirmingOrder}
                  onClick={() => {
                    setNotice(null);
                    setError(null);

                    startConfirmTransition(async () => {
                      try {
                        await readApiPayload(
                          await fetch(`/api/commerce/orders/${pendingOrder.id}/confirm`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              paymentChannel: selectedChannel,
                              notes: "dev_manual_confirm",
                            }),
                          }),
                        );

                        captureAnalyticsEvent(telemetryEvents.checkoutPaid, {
                          orderId: pendingOrder.id,
                          paymentChannel: selectedChannel,
                          source: "mock_confirm",
                        });
                        setNotice("开发态模拟支付成功，套餐权益已发放。");
                        router.refresh();
                      } catch (requestError) {
                        setError(
                          requestError instanceof Error
                            ? requestError.message
                            : "模拟支付确认失败，请稍后重试。",
                        );
                      }
                    });
                  }}
                >
                  {isConfirmingOrder ? "确认中..." : "开发态模拟支付成功"}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
              当前没有待支付订单。点击上方付费套餐按钮后，这里会显示新的订单和支付说明。
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="订单记录"
          description="便于运营核对用户当前的订单状态和最近一次支付结果。"
        >
          {overview.orders.length > 0 ? (
            <div className="space-y-3">
              {overview.orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {order.planCode === "jd_diagnose_pack_29" ? "29 元冲刺包" : "免费试用"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        状态：{getOrderStatusLabel(order)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {formatAmount(order.amountCents, order.currency)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    渠道：{getPaymentChannelLabel(order.paymentChannel)} | 支付时间：{formatTime(order.paidAt)}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    外部订单号：{order.externalOrderId ?? "未回填"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
              还没有订单记录。内测阶段建议先创建一笔订单，跑通“下单 → 回调 → 权益到账”整条链路。
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
