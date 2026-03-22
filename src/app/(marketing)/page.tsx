import Link from "next/link";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";

const productPillars = [
  {
    title: "建档资产化",
    description:
      "基础信息、教育、项目、实习、奖项和技能都会真实落库，并沉淀为后续 ResumeGeneratorAgent 使用的 profile snapshot。",
    highlight:
      "当前已接通真实表单、服务层和数据库链路，可以直接继续完善个人资料。",
  },
  {
    title: "岗位导向优化",
    description:
      "围绕 JD 关键词、职责和匹配差距生成岗位版简历，而不是泛化改写。",
    highlight:
      "已支持 JD 解析、岗位定制、差异展示和版本来源追踪。",
  },
  {
    title: "可解释与可回滚",
    description:
      "编辑、优化和诊断应用都会默认生成新版本，保留来源、改动说明和后续 diff 能力。",
    highlight:
      "当前版本链已经支持复制、重命名、回滚、删除和时间线查看。",
  },
  {
    title: "稳定导出交付",
    description:
      "以 Markdown + JSON 双存为基础，支持服务端 HTML 渲染后导出 PDF。",
    highlight:
      "Markdown 与 PDF 导出都已打通，并会写入 exports 和 audit_logs。",
  },
];

const workflow = [
  "建档",
  "母版生成",
  "JD 定制",
  "简历诊断",
  "版本管理",
  "PDF/Markdown 导出",
];

export default async function HomePage() {
  const session = await getAuthSession();

  return (
    <div className="pb-12">
      <SiteHeader authenticated={Boolean(session?.user)} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <SectionCard
            eyebrow="已打通主流程"
            title="岗位导向型 AI 求职简历助手"
            description="当前版本已经完成建档、母版简历生成、JD 定制优化、简历诊断、版本管理和 Markdown/PDF 导出主链路，并接入认证、审计日志与基础监控。"
            className="overflow-hidden"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {workflow.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-2 text-sm text-[color:var(--muted)]"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={session?.user ? "/dashboard" : "/register"}
                  className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
                >
                  {session?.user ? "进入工作台" : "创建账号并开始"}
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                >
                  查看登录入口
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Tech Stack"
            title="Next.js + Prisma + NextAuth"
            description="技术选型对齐 TechDesign 的默认路线，并已经接好 AI 编排、版本化数据模型、导出服务和监控钩子。"
          >
            <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <li>前端：Next.js 16 / React 19 / TypeScript / Tailwind CSS 4</li>
              <li>后端：App Router Route Handlers + Server Actions</li>
              <li>数据层：PostgreSQL + Prisma，核心实体已完整建模</li>
              <li>认证：NextAuth Credentials 模式，已支持注册、登录和密码重置</li>
            </ul>
          </SectionCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {productPillars.map((pillar) => (
            <SectionCard
              key={pillar.title}
              title={pillar.title}
              description={pillar.description}
              className="h-full"
            >
              <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--accent-strong)]">
                {pillar.highlight}
              </div>
            </SectionCard>
          ))}
        </section>
      </main>
    </div>
  );
}
