import Link from "next/link";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";

const workflowSteps = [
  {
    step: "01",
    title: "先把资料建档沉淀下来",
    description:
      "把基础信息、教育、项目、实习、奖项和技能收进一份长期可复用的资料库，后面所有生成都围绕这份真实资料进行。",
  },
  {
    step: "02",
    title: "生成一份可投递的母版简历",
    description:
      "系统会把零散经历整理成结构清晰、中文排版稳定、便于继续编辑的母版，而不是一次性写完就丢的文案。",
  },
  {
    step: "03",
    title: "针对目标岗位做 JD 定制",
    description:
      "先解析岗位描述，再做关键词对齐、职责映射和匹配差距提示，默认另存为新的岗位版本，不覆盖母版。",
  },
  {
    step: "04",
    title: "诊断问题并持续管理版本",
    description:
      "内容、表达、结构、匹配和 ATS 风险会分开展示，支持把自动建议另存为新版本，再继续比较和导出。",
  },
] as const;

const valueCards = [
  {
    title: "更像求职工作台，不像一次性生成器",
    description:
      "一份母版，多个岗位版本，所有优化和诊断都有来源和回滚能力，适合长期维护个人简历资产。",
  },
  {
    title: "强调真实边界，不帮用户编事实",
    description:
      "AI 只负责改写表达、提炼关键词和提示缺失点，不会凭空补项目、伪造成果或虚构技术栈。",
  },
  {
    title: "输出可继续编辑，方便真正投递",
    description:
      "结果不是黑盒图片，而是结构化 JSON + Markdown 双存，便于继续修改、做 diff 和稳定导出。",
  },
  {
    title: "默认围绕中国学生求职语境设计",
    description:
      "更关注课程项目、竞赛、社团、实习和校招岗位的表达方式，而不是只套一个英文简历模板。",
  },
] as const;

const userScenarios = [
  {
    title: "第一次写简历的同学",
    description:
      "不知道从哪开始时，先完成建档，再生成第一份母版简历，避免面对空白页面。",
  },
  {
    title: "已经有简历但反馈很少的人",
    description:
      "把同一份经历拆成更适合不同岗位的版本，并通过诊断找出表达空泛、关键词不足等问题。",
  },
  {
    title: "要同时投多个岗位方向的人",
    description:
      "围绕一份母版快速派生前端、AI 应用、客户端等不同岗位版本，减少重复劳动。",
  },
] as const;

const pricingHighlights = [
  "免费试用：1 次母版生成、1 次 JD 定制、1 次诊断、1 次 PDF 导出",
  "29 元冲刺包：10 次 JD 定制、10 次诊断、无限版本保存、无限导出",
  "所有版本和导出记录都会保留在工作台里，方便继续维护",
] as const;

export default async function HomePage() {
  const session = await getAuthSession();

  return (
    <div className="pb-12">
      <SiteHeader authenticated={Boolean(session?.user)} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <SectionCard
            eyebrow="岗位导向型 AI 简历助手"
            title="让用户顺着真实求职链路，把一份母版简历打磨成多个可投递版本"
            description="网站不是只帮用户“生成一份好看的简历”，而是把建档、母版生成、JD 定制优化、诊断、版本管理和导出串成一条清晰工作流，让用户知道自己现在在哪一步，下一步该做什么。"
            tone="accent"
            className="min-h-[360px]"
          >
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {["真实边界", "岗位定制", "版本可回滚", "ATS 友好导出"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[color:var(--accent-soft-strong)] bg-white/70 px-3 py-2 text-sm font-medium text-[color:var(--accent)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-[color:var(--border-strong)] bg-white/70 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Step 1
                    </p>
                    <p className="mt-3 text-lg font-semibold">建档沉淀</p>
                  </div>
                  <div className="rounded-3xl border border-[color:var(--border-strong)] bg-white/70 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Step 2
                    </p>
                    <p className="mt-3 text-lg font-semibold">生成母版</p>
                  </div>
                  <div className="rounded-3xl border border-[color:var(--border-strong)] bg-white/70 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Step 3
                    </p>
                    <p className="mt-3 text-lg font-semibold">定制投递</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={session?.user ? "/dashboard" : "/register"}
                    className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)]"
                  >
                    {session?.user ? "回到工作台" : "创建账号并开始建档"}
                  </Link>
                  <Link
                    href={session?.user ? "/resumes" : "/login"}
                    className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    {session?.user ? "查看简历中心" : "已有账号，直接登录"}
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.76)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                  为什么更容易上手
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    "每个页面都会告诉用户当前阶段、下一步和能产出什么。",
                    "JD 优化、诊断和导出都围绕同一份简历资产进行，不会让人迷路。",
                    "重要动作都另存为新版本，用户不需要担心改坏原始母版。",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[color:var(--muted-strong)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="适合电脑端连续操作"
            title="一眼看清主流程，少走弯路"
            description="首版优先服务电脑端场景，所以布局会强调信息层级、主操作按钮和前后步骤关系，而不是堆很多花哨控件。"
            tone="subtle"
          >
            <div className="space-y-4">
              {[
                "资料先沉淀，再交给 AI 生成，减少无依据补写。",
                "先解析 JD，再生成岗位版，改动来源更清楚。",
                "诊断结果按内容、表达、结构、匹配、ATS 分类。",
                "导出前先看版本和模板，避免直接拿错版本投递。",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[color:var(--muted-strong)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <section id="workflow" className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--accent)]">
              Workflow
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
              用户在站内看到的应该是一条顺着走就能完成投递准备的路径
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((item) => (
              <SectionCard
                key={item.step}
                title={item.title}
                description={item.description}
                className="h-full"
              >
                <span className="inline-flex rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                  {item.step}
                </span>
              </SectionCard>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((item) => (
            <SectionCard
              key={item.title}
              title={item.title}
              description={item.description}
              className="h-full"
            >
              <div className="rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[color:var(--muted-strong)]">
                适合做长期维护的简历资产，而不是一次性生成后就失控的文案。
              </div>
            </SectionCard>
          ))}
        </section>

        <section id="scenarios" className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <SectionCard
            eyebrow="Who It Helps"
            title="主要面向中国高校学生、应届生和实习求职者"
            description="产品重点不是做一个万能写作站，而是把学生语境下常见的教育、项目、竞赛、社团和实习经历翻译成更适合岗位的表达。"
            tone="subtle"
          >
            <div className="space-y-3">
              {userScenarios.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-[color:var(--border)] bg-white/80 px-4 py-4"
                >
                  <p className="font-semibold text-[color:var(--foreground)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="What You Get"
            title="进入工作台后，用户最关心的是这三件事"
            description="界面会围绕这三个高频任务给出更明确的入口和状态提示。"
            tone="accent"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "知道资料还缺什么",
                  description: "建档页会先告诉用户必填模块完成度，避免不知道为什么还不能生成。",
                },
                {
                  title: "知道当前版本从哪来",
                  description: "简历中心、优化页和诊断页都会明确源版本与新版本关系，减少误操作。",
                },
                {
                  title: "知道下一步应该去哪",
                  description: "每个关键页都保留继续建档、编辑、定制、诊断和导出的清晰入口。",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-[color:var(--border-strong)] bg-white/70 px-4 py-4"
                >
                  <p className="font-semibold text-[color:var(--foreground)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <section id="pricing" className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionCard
            eyebrow="Pricing"
            title="先让用户顺畅完成主链路，再考虑升级付费"
            description="套餐信息会放在较后的位置，避免刚进入站点时就被商业信息打断。"
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              {pricingHighlights.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Call To Action"
            title="如果已经有账号，直接回到工作台继续推进"
            description="这次 UI 调整后的重点，就是让用户一进系统就知道现在所在阶段、接下来怎么走，以及当前内容会不会被覆盖。"
            tone="subtle"
          >
            <div className="flex flex-wrap gap-3">
              <Link
                href={session?.user ? "/dashboard" : "/register"}
                className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)]"
              >
                {session?.user ? "进入工作台" : "注册并开始使用"}
              </Link>
              <Link
                href={session?.user ? "/resumes" : "/login"}
                className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                {session?.user ? "打开简历中心" : "登录已有账号"}
              </Link>
            </div>
          </SectionCard>
        </section>
      </main>
    </div>
  );
}
