import Link from "next/link";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { getSystemReadiness } from "@/lib/env";
import { resumeService } from "@/services/resume-service";

const roadmapCards = [
  {
    title: "资料建档",
    description:
      "基础信息、教育、项目、实习、奖项和技能都已接入真实 CRUD，可直接沉淀 profile snapshot。",
    href: "/profile",
  },
  {
    title: "母版简历",
    description: "ResumeGeneratorAgent、版本存储、编辑页和预览页已经打通，可直接生成第一版母版。",
    href: "/resumes",
  },
  {
    title: "JD 定制",
    description: "已支持 JD 解析、岗位优化和差异展示，优化结果会沉淀为新的可回滚版本。",
    href: "/resumes",
  },
  {
    title: "导出与版本管理",
    description: "Markdown / PDF 导出、导出历史、版本时间线、复制和回滚能力都已可用。",
    href: "/resumes",
  },
];

export default async function DashboardPage() {
  const session = await getAuthSession();
  const displayName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "同学";
  const readiness = getSystemReadiness();
  const lifecycle = resumeService.getLifecycleSteps();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Dashboard"
        title={`${displayName}，工作台已经准备好了`}
        description="当前主链路已经打通：建档、母版生成、JD 定制、诊断、版本管理和导出都可以从这里进入。"
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="当前能力覆盖"
          description="当前版本已覆盖里程碑 1 到 7：基础设施、建档、母版简历、JD 优化、诊断、导出/版本管理与监控收尾。"
        >
          <ol className="space-y-4">
            {lifecycle.map((item, index) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="环境就绪度"
          description="这里会直接提示本地或部署环境里哪些关键变量已经配置完成。"
        >
          <div className="space-y-3">
            {readiness.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.label}</p>
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
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {roadmapCards.map((card) => (
          <SectionCard
            key={card.title}
            title={card.title}
            description={card.description}
          >
            <Link
              href={card.href}
              className="inline-flex rounded-full bg-[color:var(--accent-soft)] px-4 py-2 text-sm font-medium text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-white"
            >
              打开入口
            </Link>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}
