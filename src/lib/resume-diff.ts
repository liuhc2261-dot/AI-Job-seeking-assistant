import type { ResumeDiffSection } from "@/types/jd";
import type {
  ResumeAwardItem,
  ResumeContentJson,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeProjectItem,
  ResumeSkillGroup,
} from "@/types/resume";

type DiffBlock = {
  id: string;
  section: string;
  title: string;
  before: string[];
  after: string[];
};

function normalizeValue(value: string) {
  return value.trim();
}

function compactLines(values: string[]) {
  return values.map(normalizeValue).filter(Boolean);
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function createBlock(
  id: string,
  section: string,
  title: string,
  before: string[],
  after: string[],
) {
  return {
    id,
    section,
    title,
    before: compactLines(before),
    after: compactLines(after),
  } satisfies DiffBlock;
}

function renderDateRange(startDate: string, endDate: string) {
  return [normalizeValue(startDate), normalizeValue(endDate)]
    .filter(Boolean)
    .join(" - ");
}

function renderEducationLines(item: ResumeEducationItem) {
  return compactLines([
    [item.school, item.major, item.degree].filter(Boolean).join(" | "),
    renderDateRange(item.startDate, item.endDate),
    ...item.highlights,
  ]);
}

function renderProjectLines(item: ResumeProjectItem) {
  return compactLines([
    [item.name, item.role].filter(Boolean).join(" | "),
    renderDateRange(item.startDate, item.endDate),
    item.techStack.length > 0 ? `技术栈：${item.techStack.join(" / ")}` : "",
    ...item.bullets,
  ]);
}

function renderExperienceLines(item: ResumeExperienceItem) {
  return compactLines([
    [item.company, item.role].filter(Boolean).join(" | "),
    renderDateRange(item.startDate, item.endDate),
    ...item.bullets,
  ]);
}

function renderAwardLines(item: ResumeAwardItem) {
  return compactLines([
    [item.title, item.issuer ?? ""].filter(Boolean).join(" | "),
    item.awardDate ?? "",
    item.description ?? "",
  ]);
}

function renderSkillLines(item: ResumeSkillGroup) {
  return compactLines([
    item.category,
    item.items.join("、"),
  ]);
}

function createKey(...parts: string[]) {
  return parts.map(normalizeValue).filter(Boolean).join("::");
}

function buildUnionBlocks<T>(input: {
  section: string;
  sourceItems: T[];
  targetItems: T[];
  getKey: (item: T) => string;
  getTitle: (item: T) => string;
  renderLines: (item: T) => string[];
}) {
  const sourceMap = new Map<string, T>();
  const targetMap = new Map<string, T>();

  input.sourceItems.forEach((item) => {
    sourceMap.set(input.getKey(item), item);
  });
  input.targetItems.forEach((item) => {
    targetMap.set(input.getKey(item), item);
  });

  const keys = Array.from(new Set([...sourceMap.keys(), ...targetMap.keys()]));

  return keys.map((key) => {
    const sourceItem = sourceMap.get(key);
    const targetItem = targetMap.get(key);
    const titleSource = targetItem ?? sourceItem;

    return createBlock(
      `${input.section}-${key}`,
      input.section,
      titleSource ? input.getTitle(titleSource) : input.section,
      sourceItem ? input.renderLines(sourceItem) : [],
      targetItem ? input.renderLines(targetItem) : [],
    );
  });
}

export function buildResumeDiffSections(
  source: ResumeContentJson,
  target: ResumeContentJson,
): ResumeDiffSection[] {
  const blocks: DiffBlock[] = [
    createBlock(
      "basic-target-role",
      "basic",
      "目标岗位",
      source.basic.targetRole ? [source.basic.targetRole] : [],
      target.basic.targetRole ? [target.basic.targetRole] : [],
    ),
    createBlock(
      "summary",
      "summary",
      "个人简介",
      source.summary ? [source.summary] : [],
      target.summary ? [target.summary] : [],
    ),
    ...buildUnionBlocks({
      section: "education",
      sourceItems: source.education,
      targetItems: target.education,
      getKey: (item) => createKey(item.school, item.major, item.degree),
      getTitle: (item) => `教育经历 · ${item.school}`,
      renderLines: renderEducationLines,
    }),
    ...buildUnionBlocks({
      section: "projects",
      sourceItems: source.projects,
      targetItems: target.projects,
      getKey: (item) => createKey(item.name, item.role),
      getTitle: (item) => `项目经历 · ${item.name}`,
      renderLines: renderProjectLines,
    }),
    ...buildUnionBlocks({
      section: "experiences",
      sourceItems: source.experiences,
      targetItems: target.experiences,
      getKey: (item) => createKey(item.company, item.role),
      getTitle: (item) => `实习经历 · ${item.company}`,
      renderLines: renderExperienceLines,
    }),
    ...buildUnionBlocks({
      section: "skills",
      sourceItems: source.skills,
      targetItems: target.skills,
      getKey: (item) => createKey(item.category),
      getTitle: (item) => `技能清单 · ${item.category}`,
      renderLines: renderSkillLines,
    }),
    ...buildUnionBlocks({
      section: "awards",
      sourceItems: source.awards,
      targetItems: target.awards,
      getKey: (item) => createKey(item.title, item.issuer ?? ""),
      getTitle: (item) => `奖项与证书 · ${item.title}`,
      renderLines: renderAwardLines,
    }),
  ];

  return blocks
    .filter((block) => !arraysEqual(block.before, block.after))
    .map((block) => {
      const changeKind =
        block.before.length === 0
          ? "added"
          : block.after.length === 0
            ? "removed"
            : "updated";

      return {
        ...block,
        changeKind,
      };
    });
}
