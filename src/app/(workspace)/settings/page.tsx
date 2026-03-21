import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { getSystemReadiness } from "@/lib/env";

const securityRules = [
  "所有私人数据读写都必须显式带 user_id 约束。",
  "日志、错误提示和前端 toast 不暴露完整简历全文或敏感凭据。",
  "岗位优化、诊断应用和局部改写默认创建新版本，不覆盖母版。",
];

const monitoringChecklist = [
  "Sentry：在本地或部署环境填入 `SENTRY_DSN`，若需要浏览器侧采集可同时填 `NEXT_PUBLIC_SENTRY_DSN`。",
  "PostHog：填入 `NEXT_PUBLIC_POSTHOG_TOKEN`，若不是默认 US 区域，再同步修改 `NEXT_PUBLIC_POSTHOG_HOST`。",
  "配置完成后，至少手工走一遍 `注册 → 建档 → 生成 → 诊断 → PDF 导出`，确认事件和错误都能在控制台看到。",
];

export default function SettingsPage() {
  const readiness = getSystemReadiness();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Settings"
        title="项目配置与安全边界"
        description="这里先把环境配置和关键安全原则展示出来，方便后续开发时快速对齐。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="环境变量状态"
          description="复制 `.env.example` 后可逐项补齐。"
        >
          <div className="space-y-3">
            {readiness.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {item.description}
                  </p>
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
          title="默认安全原则"
          description="完全对齐 AGENTS.md 与 TechDesign 的基础安全约束。"
        >
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            {securityRules.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <SectionCard
        title="监控联调清单"
        description="代码已经接好，真正开始上报还需要把项目自己的 DSN / Token 填进环境变量。"
      >
        <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
          {monitoringChecklist.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
