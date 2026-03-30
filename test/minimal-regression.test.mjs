import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  importFreshModule,
  resetTestState,
  setModuleMocks,
  toTestFileUrl,
} from "./helpers/module-helpers.mjs";

const dbMockUrl = toTestFileUrl("mocks/lib-db.mjs");
const resumeDocumentMockUrl = toTestFileUrl("mocks/lib-resume-document.mjs");
const profileServiceMockUrl = toTestFileUrl("mocks/services-profile-service.mjs");
const resumeGeneratorAgentMockUrl = toTestFileUrl("mocks/ai-resume-generator-agent.mjs");
const resumeApiMockUrl = toTestFileUrl("mocks/lib-api-resume.mjs");
const commercialApiMockUrl = toTestFileUrl("mocks/lib-api-commercial.mjs");
const exportStorageMockUrl = toTestFileUrl("mocks/lib-export-storage.mjs");
const exportServiceMockUrl = toTestFileUrl("mocks/services-export-service.mjs");
const commercialAccessServiceMockUrl = toTestFileUrl(
  "mocks/services-commercial-access-service.mjs",
);
const personalPaymentsMockUrl = toTestFileUrl("mocks/lib-payments-personal.mjs");
const paymentServiceMockUrl = toTestFileUrl("mocks/services-payment-service.mjs");
const resumeServiceMockUrl = toTestFileUrl("mocks/services-resume-service.mjs");

function createResumeContent(overrides = {}) {
  return {
    basic: {
      name: "测试同学",
      phone: "13800000000",
      email: "student@example.com",
      city: "上海",
      targetRole: "前端开发实习生",
      homepageUrl: "",
      githubUrl: "",
      ...(overrides.basic ?? {}),
    },
    summary: overrides.summary ?? "默认摘要",
    education: overrides.education ?? [],
    projects: overrides.projects ?? [],
    experiences: overrides.experiences ?? [],
    awards: overrides.awards ?? [],
    skills: overrides.skills ?? [],
  };
}

function cloneValue(value) {
  return structuredClone(value);
}

function pickFields(record, selection) {
  const picked = {};

  for (const [key, enabled] of Object.entries(selection)) {
    if (enabled === true) {
      picked[key] = record[key];
    }
  }

  return picked;
}

function nextDate(state) {
  state.clockTick = (state.clockTick ?? 0) + 1;

  return new Date(`2026-03-20T10:00:${String(state.clockTick).padStart(2, "0")}Z`);
}

function createExportPrismaMock(state) {
  function getResumeVersion(versionId) {
    return state.resumeVersions.find((version) => version.id === versionId) ?? null;
  }

  function mapExportWithVersion(record, selection) {
    const resumeVersion = getResumeVersion(record.resumeVersionId);

    if (!resumeVersion) {
      throw new Error(`TEST_RESUME_VERSION_NOT_FOUND:${record.resumeVersionId}`);
    }

    return {
      ...cloneValue(record),
      resumeVersion: pickFields(resumeVersion, selection),
    };
  }

  return {
    export: {
      async findFirst({ where, include, select }) {
        const record =
          state.exports.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!record) {
          return null;
        }

        if (select) {
          const selectedRecord = pickFields(record, select);

          if (select.resumeVersion?.select) {
            const resumeVersion = getResumeVersion(record.resumeVersionId);
            selectedRecord.resumeVersion = pickFields(
              resumeVersion,
              select.resumeVersion.select,
            );
          }

          return selectedRecord;
        }

        if (include?.resumeVersion?.select) {
          return mapExportWithVersion(record, include.resumeVersion.select);
        }

        return cloneValue(record);
      },
      async create({ data, include }) {
        state.nextExportId = (state.nextExportId ?? 1) + 1;

        const createdRecord = {
          id: `export-${state.nextExportId}`,
          userId: data.userId,
          resumeVersionId: data.resumeVersionId,
          exportType: data.exportType,
          templateName: data.templateName,
          fileUrl: null,
          fileSize: null,
          status: data.status,
          createdAt: nextDate(state),
        };

        state.exports.push(createdRecord);

        if (include?.resumeVersion?.select) {
          return mapExportWithVersion(createdRecord, include.resumeVersion.select);
        }

        return cloneValue(createdRecord);
      },
      async update({ where, data, include }) {
        const targetRecord = state.exports.find((record) => record.id === where.id);

        if (!targetRecord) {
          throw new Error(`TEST_EXPORT_NOT_FOUND:${where.id}`);
        }

        Object.assign(targetRecord, cloneValue(data));

        if (include?.resumeVersion?.select) {
          return mapExportWithVersion(targetRecord, include.resumeVersion.select);
        }

        return cloneValue(targetRecord);
      },
    },
    resumeVersion: {
      async findFirst({ where, select }) {
        const version =
          state.resumeVersions.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.resumeId || item.resumeId === where.resumeId) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!version) {
          return null;
        }

        return select ? pickFields(version, select) : cloneValue(version);
      },
    },
    resume: {
      async findFirst({ where, select }) {
        const resume =
          state.resumes.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!resume) {
          return null;
        }

        return select ? pickFields(resume, select) : cloneValue(resume);
      },
    },
    auditLog: {
      async create({ data }) {
        state.auditLogs.push(cloneValue(data));

        return cloneValue(data);
      },
    },
  };
}

function createResumePrismaMock(state) {
  function getResume(resumeId) {
    return state.resumes.find((resume) => resume.id === resumeId) ?? null;
  }

  function getVersionsByResume(resumeId) {
    return state.versions
      .filter((version) => version.resumeId === resumeId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  function buildVersionCount(versionId, selection = {}) {
    const selectedCount = {};

    if (selection.derivedVersions) {
      selectedCount.derivedVersions = state.versions.filter(
        (version) => version.sourceVersionId === versionId,
      ).length;
    }

    if (selection.jdAnalyses) {
      selectedCount.jdAnalyses = (state.jdAnalyses ?? []).filter(
        (analysis) => analysis.resumeVersionId === versionId,
      ).length;
    }

    if (selection.diagnosisReports) {
      selectedCount.diagnosisReports = (state.diagnosisReports ?? []).filter(
        (report) => report.resumeVersionId === versionId,
      ).length;
    }

    if (selection.exports) {
      selectedCount.exports = (state.exports ?? []).filter(
        (record) => record.resumeVersionId === versionId,
      ).length;
    }

    return selectedCount;
  }

  function buildResumeInclude(resume, include) {
    const result = {
      ...cloneValue(resume),
    };

    if (include?.versions) {
      const sortedVersions = getVersionsByResume(resume.id);
      const limitedVersions =
        typeof include.versions.take === "number"
          ? sortedVersions.slice(0, include.versions.take)
          : sortedVersions;

      result.versions = limitedVersions.map((version) => cloneValue(version));
    }

    if (include?._count?.select?.versions) {
      result._count = {
        versions: getVersionsByResume(resume.id).length,
      };
    }

    return result;
  }

  const transactionApi = {
    resumeVersion: {
      async create({ data }) {
        state.nextVersionId = (state.nextVersionId ?? state.versions.length) + 1;
        const createdAt = nextDate(state);
        const createdVersion = {
          id: `version-${state.nextVersionId}`,
          resumeId: data.resumeId,
          userId: data.userId,
          versionName: data.versionName,
          versionType: data.versionType,
          sourceVersionId: data.sourceVersionId ?? null,
          jobTargetTitle: data.jobTargetTitle ?? null,
          jobTargetCompany: data.jobTargetCompany ?? null,
          contentMarkdown: data.contentMarkdown,
          contentJson: cloneValue(data.contentJson),
          changeSummary: cloneValue(data.changeSummary ?? null),
          status: data.status,
          createdBy: data.createdBy,
          createdAt,
          updatedAt: createdAt,
        };

        state.versions.push(createdVersion);
        const resume = getResume(data.resumeId);

        if (resume) {
          resume.updatedAt = createdAt;
        }

        return cloneValue(createdVersion);
      },
      async update({ where, data }) {
        const targetVersion = state.versions.find((version) => version.id === where.id);

        if (!targetVersion) {
          throw new Error(`TEST_VERSION_NOT_FOUND:${where.id}`);
        }

        Object.assign(targetVersion, cloneValue(data), {
          updatedAt: nextDate(state),
        });

        return cloneValue(targetVersion);
      },
      async delete({ where }) {
        const targetIndex = state.versions.findIndex((version) => version.id === where.id);

        if (targetIndex < 0) {
          throw new Error(`TEST_VERSION_NOT_FOUND:${where.id}`);
        }

        const [deletedVersion] = state.versions.splice(targetIndex, 1);

        state.versions.forEach((version) => {
          if (version.sourceVersionId === deletedVersion.id) {
            version.sourceVersionId = null;
          }
        });

        return cloneValue(deletedVersion);
      },
    },
    auditLog: {
      async create({ data }) {
        state.auditLogs.push(cloneValue(data));

        return cloneValue(data);
      },
    },
  };

  return {
    resumeVersion: {
      async findFirst({ where, include }) {
        const version =
          state.versions.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.resumeId || item.resumeId === where.resumeId) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!version) {
          return null;
        }

        const resolvedVersion = {
          ...cloneValue(version),
        };

        if (include?.resume) {
          const resume = getResume(version.resumeId);
          resolvedVersion.resume = buildResumeInclude(resume, include.resume.include);
        }

        if (include?._count?.select) {
          resolvedVersion._count = buildVersionCount(version.id, include._count.select);
        }

        return resolvedVersion;
      },
    },
    resume: {
      async findFirst({ where, include, select }) {
        const resume =
          state.resumes.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!resume) {
          return null;
        }

        if (select) {
          return pickFields(resume, select);
        }

        if (include) {
          return buildResumeInclude(resume, include);
        }

        return cloneValue(resume);
      },
    },
    $transaction(callback) {
      return callback(transactionApi);
    },
  };
}

function createResumeState() {
  const masterContent = createResumeContent({
    summary: "母版摘要",
  });
  const manualContent = createResumeContent({
    summary: "手动版摘要",
  });

  return {
    clockTick: 2,
    resumes: [
      {
        id: "resume-1",
        userId: "user-1",
        name: "测试简历",
        status: "ACTIVE",
        updatedAt: new Date("2026-03-20T09:00:02Z"),
      },
    ],
    versions: [
      {
        id: "version-master",
        resumeId: "resume-1",
        userId: "user-1",
        versionName: "母版 v1",
        versionType: "MASTER",
        sourceVersionId: null,
        jobTargetTitle: null,
        jobTargetCompany: null,
        contentMarkdown: "markdown:母版",
        contentJson: masterContent,
        changeSummary: null,
        status: "READY",
        createdBy: "AI_GENERATE",
        createdAt: new Date("2026-03-20T09:00:01Z"),
        updatedAt: new Date("2026-03-20T09:00:01Z"),
      },
      {
        id: "version-manual",
        resumeId: "resume-1",
        userId: "user-1",
        versionName: "手动编辑 v2",
        versionType: "MANUAL",
        sourceVersionId: "version-master",
        jobTargetTitle: null,
        jobTargetCompany: null,
        contentMarkdown: "markdown:手动版",
        contentJson: manualContent,
        changeSummary: null,
        status: "READY",
        createdBy: "MANUAL",
        createdAt: new Date("2026-03-20T09:00:02Z"),
        updatedAt: new Date("2026-03-20T09:00:02Z"),
      },
    ],
    auditLogs: [],
  };
}

function createProfilePrismaMock(state) {
  function findUser(where) {
    if (where.id) {
      return state.users.find((user) => user.id === where.id) ?? null;
    }

    if (where.email) {
      return state.users.find((user) => user.email === where.email) ?? null;
    }

    return null;
  }

  function getUserProfile(userId) {
    return state.userProfiles.find((profile) => profile.userId === userId) ?? null;
  }

  function buildProfileSnapshot(userId) {
    const user = state.users.find((item) => item.id === userId) ?? null;

    if (!user) {
      return null;
    }

    return {
      email: user.email,
      profile: cloneValue(getUserProfile(userId)),
      educations: cloneValue(state.educations.filter((item) => item.userId === userId)),
      projects: cloneValue(state.projects.filter((item) => item.userId === userId)),
      experiences: cloneValue(state.experiences.filter((item) => item.userId === userId)),
      awards: cloneValue(state.awards.filter((item) => item.userId === userId)),
      skills: cloneValue(state.skills.filter((item) => item.userId === userId)),
    };
  }

  return {
    user: {
      async findUnique({ where, select }) {
        const user = findUser(where);

        if (!user) {
          return null;
        }

        if (select?.id) {
          return {
            id: user.id,
          };
        }

        return buildProfileSnapshot(user.id);
      },
    },
    experience: {
      async create({ data }) {
        state.nextExperienceId = (state.nextExperienceId ?? 0) + 1;
        const now = nextDate(state);
        const createdRecord = {
          id: `experience-${state.nextExperienceId}`,
          userId: data.userId,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          startDate: data.startDate,
          endDate: data.endDate,
          descriptionRaw: data.descriptionRaw,
          resultRaw: data.resultRaw ?? null,
          createdAt: now,
          updatedAt: now,
        };

        state.experiences.push(createdRecord);

        return cloneValue(createdRecord);
      },
      async findFirst({ where, select }) {
        const experience =
          state.experiences.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!experience) {
          return null;
        }

        return select ? pickFields(experience, select) : cloneValue(experience);
      },
      async update({ where, data }) {
        const experience = state.experiences.find((item) => item.id === where.id);

        if (!experience) {
          throw new Error(`TEST_EXPERIENCE_NOT_FOUND:${where.id}`);
        }

        Object.assign(experience, cloneValue(data), {
          updatedAt: nextDate(state),
        });

        return cloneValue(experience);
      },
      async delete({ where }) {
        const targetIndex = state.experiences.findIndex((item) => item.id === where.id);

        if (targetIndex < 0) {
          throw new Error(`TEST_EXPERIENCE_NOT_FOUND:${where.id}`);
        }

        const [deletedRecord] = state.experiences.splice(targetIndex, 1);

        return cloneValue(deletedRecord);
      },
    },
    award: {
      async create({ data }) {
        state.nextAwardId = (state.nextAwardId ?? 0) + 1;
        const now = nextDate(state);
        const createdRecord = {
          id: `award-${state.nextAwardId}`,
          userId: data.userId,
          title: data.title,
          issuer: data.issuer ?? null,
          awardDate: data.awardDate ?? null,
          description: data.description ?? null,
          createdAt: now,
          updatedAt: now,
        };

        state.awards.push(createdRecord);

        return cloneValue(createdRecord);
      },
      async findFirst({ where, select }) {
        const award =
          state.awards.find((item) => {
            return (
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId)
            );
          }) ?? null;

        if (!award) {
          return null;
        }

        return select ? pickFields(award, select) : cloneValue(award);
      },
      async update({ where, data }) {
        const award = state.awards.find((item) => item.id === where.id);

        if (!award) {
          throw new Error(`TEST_AWARD_NOT_FOUND:${where.id}`);
        }

        Object.assign(award, cloneValue(data), {
          updatedAt: nextDate(state),
        });

        return cloneValue(award);
      },
      async delete({ where }) {
        const targetIndex = state.awards.findIndex((item) => item.id === where.id);

        if (targetIndex < 0) {
          throw new Error(`TEST_AWARD_NOT_FOUND:${where.id}`);
        }

        const [deletedRecord] = state.awards.splice(targetIndex, 1);

        return cloneValue(deletedRecord);
      },
    },
    auditLog: {
      async create({ data }) {
        state.auditLogs.push(cloneValue(data));

        return cloneValue(data);
      },
    },
  };
}

function createCommercialPrismaMock(state) {
  function findUser(where) {
    if (where.id) {
      return state.users.find((user) => user.id === where.id) ?? null;
    }

    if (where.email) {
      return state.users.find((user) => user.email === where.email) ?? null;
    }

    return null;
  }

  function buildCommercialProfile(createInput) {
    state.nextCommercialProfileId = (state.nextCommercialProfileId ?? 0) + 1;
    const now = nextDate(state);

    return {
      id: `commerce-profile-${state.nextCommercialProfileId}`,
      userId: createInput.userId,
      accessTier: "TRIAL",
      planCode: "TRIAL",
      masterResumeCreditsRemaining: 1,
      jdTailorCreditsRemaining: 1,
      diagnosisCreditsRemaining: 1,
      pdfExportCreditsRemaining: 1,
      hasUnlimitedExports: false,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  function getCommercialProfile(where) {
    if (where.id) {
      return state.commerceProfiles.find((profile) => profile.id === where.id) ?? null;
    }

    if (where.userId) {
      return (
        state.commerceProfiles.find((profile) => profile.userId === where.userId) ?? null
      );
    }

    return null;
  }

  function applyProfileMutation(profile, data) {
    const updatedProfile = profile;

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "decrement" in value) {
        updatedProfile[key] -= value.decrement;
        continue;
      }

      updatedProfile[key] = cloneValue(value);
    }

    updatedProfile.updatedAt = nextDate(state);

    return updatedProfile;
  }

  function getCommerceOrder(where) {
    return (
      state.commerceOrders.find((order) => {
        return (
          (!where.id || order.id === where.id) &&
          (!where.userId || order.userId === where.userId) &&
          (!where.planCode || order.planCode === where.planCode) &&
          (!where.status || order.status === where.status)
        );
      }) ?? null
    );
  }

  function applyOrderMutation(order, data) {
    const updatedOrder = order;

    for (const [key, value] of Object.entries(data)) {
      updatedOrder[key] = cloneValue(value);
    }

    updatedOrder.updatedAt = nextDate(state);

    return updatedOrder;
  }

  const transactionApi = {
    user: {
      async findUnique({ where, select }) {
        const user = findUser(where);

        if (!user) {
          return null;
        }

        return select ? pickFields(user, select) : cloneValue(user);
      },
      async findFirst({ where, select }) {
        const user = findUser(where);

        if (!user) {
          return null;
        }

        return select ? pickFields(user, select) : cloneValue(user);
      },
    },
    userCommerceProfile: {
      async findUnique({ where }) {
        const profile = getCommercialProfile(where);

        return profile ? cloneValue(profile) : null;
      },
      async upsert({ where, create }) {
        const existingProfile = getCommercialProfile(where);

        if (existingProfile) {
          return cloneValue(existingProfile);
        }

        const createdProfile = {
          ...buildCommercialProfile(create),
          ...cloneValue(create),
        };

        state.commerceProfiles.push(createdProfile);

        return cloneValue(createdProfile);
      },
      async update({ where, data }) {
        const profile = getCommercialProfile(where);

        if (!profile) {
          throw new Error(`TEST_COMMERCE_PROFILE_NOT_FOUND:${JSON.stringify(where)}`);
        }

        return cloneValue(applyProfileMutation(profile, data));
      },
      async updateMany({ where, data }) {
        const profile = getCommercialProfile(where);

        if (!profile) {
          return { count: 0 };
        }

        const limitedField = Object.entries(where).find(([, value]) => {
          return value && typeof value === "object" && "gt" in value;
        });

        if (limitedField) {
          const [fieldName, rule] = limitedField;

          if (!(profile[fieldName] > rule.gt)) {
            return { count: 0 };
          }
        }

        applyProfileMutation(profile, data);

        return { count: 1 };
      },
    },
    commerceUsageEvent: {
      async create({ data }) {
        state.commerceUsageEvents.push({
          id: `usage-event-${state.commerceUsageEvents.length + 1}`,
          ...cloneValue(data),
          createdAt: nextDate(state),
        });

        return cloneValue(state.commerceUsageEvents.at(-1));
      },
    },
    commerceOrder: {
      async findFirst({ where }) {
        const order = getCommerceOrder(where);

        return order ? cloneValue(order) : null;
      },
      async findUnique({ where }) {
        const order = getCommerceOrder(where);

        return order ? cloneValue(order) : null;
      },
      async findMany({ where, orderBy }) {
        const direction = orderBy?.createdAt === "asc" ? 1 : -1;

        return state.commerceOrders
          .filter((order) => {
            return (
              (!where?.userId || order.userId === where.userId) &&
              (!where?.status || order.status === where.status)
            );
          })
          .sort(
            (left, right) =>
              (left.createdAt.getTime() - right.createdAt.getTime()) * direction,
          )
          .map((order) => cloneValue(order));
      },
      async create({ data }) {
        state.commerceOrders.push({
          id: `commerce-order-${state.commerceOrders.length + 1}`,
          ...cloneValue(data),
          paymentPayload: data.paymentPayload ?? null,
          paymentExpiresAt: data.paymentExpiresAt ?? null,
          createdAt: nextDate(state),
          updatedAt: nextDate(state),
        });

        return cloneValue(state.commerceOrders.at(-1));
      },
      async update({ where, data }) {
        const order = getCommerceOrder(where);

        if (!order) {
          throw new Error(`TEST_COMMERCE_ORDER_NOT_FOUND:${where.id}`);
        }

        applyOrderMutation(order, data);

        return cloneValue(order);
      },
      async updateMany({ where, data }) {
        const order = getCommerceOrder(where);

        if (!order) {
          return { count: 0 };
        }

        applyOrderMutation(order, data);

        return { count: 1 };
      },
    },
    auditLog: {
      async create({ data }) {
        state.auditLogs.push(cloneValue(data));

        return cloneValue(data);
      },
    },
  };

  return {
    ...transactionApi,
    $transaction(callback) {
      return callback(transactionApi);
    },
  };
}

beforeEach(() => {
  resetTestState();
  mock.method(console, "info", () => undefined);
  mock.method(console, "warn", () => undefined);
  mock.method(console, "error", () => undefined);
});

afterEach(() => {
  mock.restoreAll();
  resetTestState();
});

describe("commercial access service", () => {
  let previousTrialModel;
  let previousPaidModel;

  beforeEach(() => {
    previousTrialModel = process.env.OPENAI_TRIAL_MODEL;
    previousPaidModel = process.env.OPENAI_PAID_MODEL;
    process.env.OPENAI_TRIAL_MODEL = "gpt-5.1";
    process.env.OPENAI_PAID_MODEL = "gpt-5.4";
  });

  afterEach(() => {
    if (previousTrialModel === undefined) {
      delete process.env.OPENAI_TRIAL_MODEL;
    } else {
      process.env.OPENAI_TRIAL_MODEL = previousTrialModel;
    }

    if (previousPaidModel === undefined) {
      delete process.env.OPENAI_PAID_MODEL;
    } else {
      process.env.OPENAI_PAID_MODEL = previousPaidModel;
    }
  });

  it("creates a trial commerce profile lazily and routes free users to GPT-5.1", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "trial@example.com",
        },
      ],
      commerceProfiles: [],
      commerceUsageEvents: [],
      commerceOrders: [],
      auditLogs: [],
    };

    globalThis.__testPrisma = createCommercialPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { commercialAccessService } = await importFreshModule(
      "src/services/commercial-access-service.ts",
    );
    const summary = await commercialAccessService.getCommercialProfileSummary("user-1");
    const model = await commercialAccessService.getAiModelForUser("user-1");

    assert.equal(summary.accessTier, "trial");
    assert.equal(summary.planCode, "trial");
    assert.equal(summary.quotas.jdTailorCreditsRemaining, 1);
    assert.equal(summary.quotas.diagnosisCreditsRemaining, 1);
    assert.equal(model, "gpt-5.1");
    assert.equal(state.commerceProfiles.length, 1);
  });

  it("deducts credits once per successful usage and blocks exhausted JD quotas", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "trial@example.com",
        },
      ],
      commerceProfiles: [
        {
          id: "commerce-profile-1",
          userId: "user-1",
          accessTier: "TRIAL",
          planCode: "TRIAL",
          masterResumeCreditsRemaining: 1,
          jdTailorCreditsRemaining: 1,
          diagnosisCreditsRemaining: 1,
          pdfExportCreditsRemaining: 1,
          hasUnlimitedExports: false,
          activatedAt: null,
          createdAt: new Date("2026-03-20T10:00:00Z"),
          updatedAt: new Date("2026-03-20T10:00:00Z"),
        },
      ],
      commerceUsageEvents: [],
      commerceOrders: [],
      auditLogs: [],
    };

    globalThis.__testPrisma = createCommercialPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { commercialAccessService, CommercialAccessServiceError } =
      await importFreshModule("src/services/commercial-access-service.ts");

    const summary = await commercialAccessService.recordSuccessfulFeatureUsage({
      userId: "user-1",
      feature: "jd_tailor",
      resourceType: "JD_ANALYSIS",
      resourceId: "analysis-1",
    });

    assert.equal(summary.quotas.jdTailorCreditsRemaining, 0);
    assert.equal(state.commerceUsageEvents.length, 1);
    assert.equal(state.commerceUsageEvents[0].feature, "JD_TAILOR");
    assert.equal(state.commerceUsageEvents[0].remainingAfter, 0);

    await assert.rejects(
      commercialAccessService.recordSuccessfulFeatureUsage({
        userId: "user-1",
        feature: "jd_tailor",
        resourceType: "JD_ANALYSIS",
        resourceId: "analysis-2",
      }),
      (error) =>
        error instanceof CommercialAccessServiceError &&
        error.code === "JD_TAILOR_LIMIT_REACHED",
    );
  });

  it("grants the paid pack and upgrades the account to GPT-5.4 with extra credits", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "paid@example.com",
        },
      ],
      commerceProfiles: [
        {
          id: "commerce-profile-1",
          userId: "user-1",
          accessTier: "TRIAL",
          planCode: "TRIAL",
          masterResumeCreditsRemaining: 0,
          jdTailorCreditsRemaining: 1,
          diagnosisCreditsRemaining: 0,
          pdfExportCreditsRemaining: 1,
          hasUnlimitedExports: false,
          activatedAt: null,
          createdAt: new Date("2026-03-20T10:00:00Z"),
          updatedAt: new Date("2026-03-20T10:00:00Z"),
        },
      ],
      commerceUsageEvents: [],
      commerceOrders: [],
      auditLogs: [],
    };

    globalThis.__testPrisma = createCommercialPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { commercialAccessService } = await importFreshModule(
      "src/services/commercial-access-service.ts",
    );
    const result = await commercialAccessService.grantPaidPack({
      userId: "user-1",
      paymentChannel: "wechat",
      externalOrderId: "wx_001",
      notes: "launch_test",
    });

    assert.equal(result.profile.accessTier, "paid");
    assert.equal(result.profile.currentAiModel, "gpt-5.4");
    assert.equal(result.profile.quotas.masterResumeCreditsRemaining, 1);
    assert.equal(result.profile.quotas.jdTailorCreditsRemaining, 11);
    assert.equal(result.profile.quotas.diagnosisCreditsRemaining, 10);
    assert.equal(result.profile.quotas.hasUnlimitedExports, true);
    assert.equal(state.commerceOrders.length, 1);
    assert.equal(state.commerceOrders[0].status, "PAID");
    assert.equal(state.auditLogs[0].actionType, "COMMERCE_ORDER_GRANTED");
  });

  it("creates a pending checkout order once and reuses it on repeated checkout clicks", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "checkout@example.com",
        },
      ],
      commerceProfiles: [
        {
          id: "commerce-profile-1",
          userId: "user-1",
          accessTier: "TRIAL",
          planCode: "TRIAL",
          masterResumeCreditsRemaining: 1,
          jdTailorCreditsRemaining: 1,
          diagnosisCreditsRemaining: 1,
          pdfExportCreditsRemaining: 1,
          hasUnlimitedExports: false,
          activatedAt: null,
          createdAt: new Date("2026-03-20T10:00:00Z"),
          updatedAt: new Date("2026-03-20T10:00:00Z"),
        },
      ],
      commerceUsageEvents: [],
      commerceOrders: [],
      auditLogs: [],
    };

    globalThis.__testPrisma = createCommercialPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { commercialAccessService } = await importFreshModule(
      "src/services/commercial-access-service.ts",
    );
    const firstCheckout = await commercialAccessService.createCheckoutOrder({
      userId: "user-1",
      planCode: "jd_diagnose_pack_29",
      paymentChannel: "wechat",
    });
    const secondCheckout = await commercialAccessService.createCheckoutOrder({
      userId: "user-1",
      planCode: "jd_diagnose_pack_29",
      paymentChannel: "wechat",
    });

    assert.equal(firstCheckout.reusedExistingOrder, false);
    assert.equal(secondCheckout.reusedExistingOrder, true);
    assert.equal(state.commerceOrders.length, 1);
    assert.equal(state.commerceOrders[0].status, "PENDING");
    assert.equal(state.auditLogs[0].actionType, "COMMERCE_ORDER_CREATED");
  });

  it("uses personal collection QR codes when merchant payment config is unavailable", async () => {
    globalThis.__testPrisma = createCommercialPrismaMock({
      clockTick: 0,
      users: [],
      commerceProfiles: [],
      commerceUsageEvents: [],
      commerceOrders: [],
      auditLogs: [],
    });
    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/payments", personalPaymentsMockUrl],
    ]);

    const { paymentService } = await importFreshModule(
      "src/services/payment-service.ts",
    );
    const session = await paymentService.createCheckoutSession({
      orderId: "commerce-order-1",
      amountCents: 2900,
      planLabel: "29 元冲刺包",
      paymentChannel: "wechat",
    });

    assert.equal(session.status, "ready");
    assert.equal(session.qrCodeDataUrl, "https://example.com/payments/wechat-qr.png");
    assert.equal(session.displayTitle, "微信个人收款码");
  });

  it("confirms a pending order idempotently and grants credits only once", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "checkout@example.com",
        },
      ],
      commerceProfiles: [
        {
          id: "commerce-profile-1",
          userId: "user-1",
          accessTier: "TRIAL",
          planCode: "TRIAL",
          masterResumeCreditsRemaining: 0,
          jdTailorCreditsRemaining: 1,
          diagnosisCreditsRemaining: 1,
          pdfExportCreditsRemaining: 1,
          hasUnlimitedExports: false,
          activatedAt: null,
          createdAt: new Date("2026-03-20T10:00:00Z"),
          updatedAt: new Date("2026-03-20T10:00:00Z"),
        },
      ],
      commerceUsageEvents: [],
      commerceOrders: [
        {
          id: "commerce-order-1",
          userId: "user-1",
          profileId: "commerce-profile-1",
          planCode: "JD_DIAGNOSE_PACK_29",
          amountCents: 2900,
          currency: "CNY",
          status: "PENDING",
          paymentChannel: "wechat",
          externalOrderId: null,
          notes: "checkout_created",
          paidAt: null,
          createdAt: new Date("2026-03-20T11:00:00Z"),
          updatedAt: new Date("2026-03-20T11:00:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createCommercialPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { commercialAccessService } = await importFreshModule(
      "src/services/commercial-access-service.ts",
    );
    const firstConfirm = await commercialAccessService.confirmOrderPaid({
      orderId: "commerce-order-1",
      userId: "user-1",
      paymentChannel: "wechat",
      externalOrderId: "wx_001",
    });
    const secondConfirm = await commercialAccessService.confirmOrderPaid({
      orderId: "commerce-order-1",
      userId: "user-1",
      paymentChannel: "wechat",
      externalOrderId: "wx_001",
    });

    assert.equal(firstConfirm.alreadyProcessed, false);
    assert.equal(secondConfirm.alreadyProcessed, true);
    assert.equal(firstConfirm.profile.accessTier, "paid");
    assert.equal(firstConfirm.profile.currentAiModel, "gpt-5.4");
    assert.equal(firstConfirm.profile.quotas.masterResumeCreditsRemaining, 1);
    assert.equal(firstConfirm.profile.quotas.jdTailorCreditsRemaining, 11);
    assert.equal(firstConfirm.profile.quotas.diagnosisCreditsRemaining, 11);
    assert.equal(firstConfirm.profile.quotas.hasUnlimitedExports, true);
    assert.equal(state.commerceOrders[0].status, "PAID");
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "COMMERCE_ORDER_PAID");
  });
});

describe("export-service minimal regression", () => {
  it("retries a failed markdown export by creating a new success record and preserving history", async () => {
    const state = {
      clockTick: 0,
      nextExportId: 1,
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "母版 v1",
          versionType: "MASTER",
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "# Resume\n- shipped feature",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "MARKDOWN",
          templateName: "source-markdown",
          fileUrl: null,
          fileSize: null,
          status: "FAILED",
          createdAt: new Date("2026-03-20T08:00:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { exportService } = await importFreshModule("src/services/export-service.ts");
    const exportRecord = await exportService.retryExport({
      userId: "user-1",
      exportId: "export-1",
    });

    const retriedRecord = state.exports.find((record) => record.id !== "export-1");

    assert.equal(state.exports.length, 2);
    assert.equal(state.exports[0].status, "FAILED");
    assert.ok(retriedRecord);
    assert.equal(retriedRecord.status, "SUCCESS");
    assert.equal(retriedRecord.templateName, "source-markdown");
    assert.equal(retriedRecord.fileUrl, `/api/exports/${retriedRecord.id}`);
    assert.equal(exportRecord.id, retriedRecord.id);
    assert.equal(exportRecord.status, "success");
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.auditLogs[0].actionType, "EXPORT_CREATED");
    assert.equal(state.auditLogs[1].actionType, "EXPORT_RETRIED");
    assert.equal(state.auditLogs[1].payload.previousExportId, "export-1");
  });

  it("reuses the original pdf template when retrying a failed pdf export", async () => {
    const state = {
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "母版 v1",
          versionType: "MASTER",
          jobTargetTitle: "前端开发实习生",
          jobTargetCompany: null,
          contentMarkdown: "irrelevant",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "PDF",
          templateName: "ats-standard",
          fileUrl: null,
          fileSize: null,
          status: "FAILED",
          createdAt: new Date("2026-03-20T08:10:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { exportService } = await importFreshModule("src/services/export-service.ts");
    let capturedInput = null;

    mock.method(exportService, "createPdfExport", async (input) => {
      capturedInput = input;

      return {
        id: "export-pdf-retried",
        resumeId: "resume-1",
        resumeVersionId: "version-1",
        resumeVersionName: "母版 v1",
        resumeVersionType: "master",
        jobTargetTitle: "前端开发实习生",
        jobTargetCompany: null,
        exportType: "pdf",
        templateName: input.templateName,
        status: "success",
        fileUrl: "/api/exports/export-pdf-retried",
        fileSize: 1024,
        createdAt: "2026-03-20T10:00:00.000Z",
      };
    });

    await exportService.retryExport({
      userId: "user-1",
      exportId: "export-1",
    });

    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      resumeVersionId: "version-1",
      templateName: "ats-standard",
    });
  });

  it("records EXPORT_RETRIED when a failed pdf export is retried", async () => {
    const state = {
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "姣嶇増 v1",
          versionType: "MASTER",
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "irrelevant",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "PDF",
          templateName: "ats-standard",
          fileUrl: null,
          fileSize: null,
          status: "FAILED",
          createdAt: new Date("2026-03-20T08:15:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { exportService } = await importFreshModule("src/services/export-service.ts");

    mock.method(exportService, "createPdfExport", async () => {
      return {
        id: "export-pdf-retried",
        resumeId: "resume-1",
        resumeVersionId: "version-1",
        resumeVersionName: "姣嶇増 v1",
        resumeVersionType: "master",
        jobTargetTitle: null,
        jobTargetCompany: null,
        exportType: "pdf",
        templateName: "ats-standard",
        status: "success",
        fileUrl: "/api/exports/export-pdf-retried",
        fileSize: 2048,
        createdAt: "2026-03-20T10:00:00.000Z",
      };
    });

    await exportService.retryExport({
      userId: "user-1",
      exportId: "export-1",
    });

    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "EXPORT_RETRIED");
    assert.equal(state.auditLogs[0].payload.previousExportId, "export-1");
    assert.equal(state.auditLogs[0].payload.retriedExportId, "export-pdf-retried");
  });

  it("rejects retries for exports that already succeeded", async () => {
    const state = {
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "母版 v1",
          versionType: "MASTER",
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "irrelevant",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "MARKDOWN",
          templateName: "source-markdown",
          fileUrl: "/api/exports/export-1",
          fileSize: 256,
          status: "SUCCESS",
          createdAt: new Date("2026-03-20T08:20:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { ExportServiceError, exportService } = await importFreshModule(
      "src/services/export-service.ts",
    );

    await assert.rejects(
      () =>
        exportService.retryExport({
          userId: "user-1",
          exportId: "export-1",
        }),
      (error) => {
        assert.ok(error instanceof ExportServiceError);
        assert.equal(error.code, "EXPORT_RETRY_NOT_ALLOWED");
        return true;
      },
    );
  });

  it("keeps export records user-isolated during retry lookup", async () => {
    const state = {
      resumes: [
        {
          id: "resume-1",
          userId: "user-2",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-2",
          versionName: "母版 v1",
          versionType: "MASTER",
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "irrelevant",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-2",
          resumeVersionId: "version-1",
          exportType: "MARKDOWN",
          templateName: "source-markdown",
          fileUrl: null,
          fileSize: null,
          status: "FAILED",
          createdAt: new Date("2026-03-20T08:30:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { ExportServiceError, exportService } = await importFreshModule(
      "src/services/export-service.ts",
    );

    await assert.rejects(
      () =>
        exportService.retryExport({
          userId: "user-1",
          exportId: "export-1",
        }),
      (error) => {
        assert.ok(error instanceof ExportServiceError);
        assert.equal(error.code, "EXPORT_NOT_FOUND");
        return true;
      },
    );
  });

  it("records EXPORT_DOWNLOADED when a successful markdown export is fetched", async () => {
    const state = {
      clockTick: 0,
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "母版 v1",
          versionType: "MASTER",
          jobTargetTitle: "前端开发实习生",
          jobTargetCompany: null,
          contentMarkdown: "# Resume\n- shipped feature",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "MARKDOWN",
          templateName: "source-markdown",
          fileUrl: "/api/exports/export-1",
          fileSize: 26,
          status: "SUCCESS",
          createdAt: new Date("2026-03-20T08:30:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { exportService } = await importFreshModule("src/services/export-service.ts");
    const download = await exportService.getExportDownload({
      userId: "user-1",
      exportId: "export-1",
      requestId: "req-download-1",
    });

    assert.equal(download.exportId, "export-1");
    assert.equal(download.exportType, "markdown");
    assert.equal(download.exportStatus, "success");
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "EXPORT_DOWNLOADED");
    assert.equal(state.auditLogs[0].payload.requestId, "req-download-1");
    assert.equal(state.auditLogs[0].payload.exportId, "export-1");
  });

  it("loads successful pdf exports from the configured export storage backend", async () => {
    const state = {
      clockTick: 0,
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "master v1",
          versionType: "MASTER",
          jobTargetTitle: "Frontend Intern",
          jobTargetCompany: null,
          contentMarkdown: "# Resume",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "PDF",
          templateName: "ats-standard",
          fileUrl: "/api/exports/export-1",
          fileSize: 12,
          status: "SUCCESS",
          createdAt: new Date("2026-03-20T08:31:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    globalThis.__testExportStorage = {
      async read(input) {
        assert.deepEqual(input, {
          exportId: "export-1",
          exportType: "PDF",
        });

        return Buffer.from("pdf-content");
      },
    };
    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/export-storage", exportStorageMockUrl],
    ]);

    const { exportService } = await importFreshModule("src/services/export-service.ts");
    const download = await exportService.getExportDownload({
      userId: "user-1",
      exportId: "export-1",
      requestId: "req-download-pdf",
    });

    assert.equal(download.exportType, "pdf");
    assert.equal(download.contentType, "application/pdf");
    assert.ok(Buffer.isBuffer(download.content));
    assert.equal(download.fileSize, 12);
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "EXPORT_DOWNLOADED");
    assert.equal(state.auditLogs[0].payload.requestId, "req-download-pdf");
  });

  it("maps missing pdf objects in export storage to EXPORT_FILE_MISSING", async () => {
    const state = {
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
        },
      ],
      resumeVersions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "master v1",
          versionType: "MASTER",
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "# Resume",
          contentJson: createResumeContent(),
        },
      ],
      exports: [
        {
          id: "export-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          exportType: "PDF",
          templateName: "ats-standard",
          fileUrl: "/api/exports/export-1",
          fileSize: 12,
          status: "SUCCESS",
          createdAt: new Date("2026-03-20T08:32:00Z"),
        },
      ],
      auditLogs: [],
    };

    globalThis.__testPrisma = createExportPrismaMock(state);
    globalThis.__testExportStorage = {
      async read() {
        throw new globalThis.__testExportStorage.ExportStorageError(
          "EXPORT_OBJECT_MISSING",
          "missing",
        );
      },
      ExportStorageError: null,
    };
    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/export-storage", exportStorageMockUrl],
    ]);

    const { ExportStorageError } = await import(exportStorageMockUrl);
    globalThis.__testExportStorage.ExportStorageError = ExportStorageError;

    const { ExportServiceError, exportService } = await importFreshModule(
      "src/services/export-service.ts",
    );

    await assert.rejects(
      () =>
        exportService.getExportDownload({
          userId: "user-1",
          exportId: "export-1",
        }),
      (error) => {
        assert.ok(error instanceof ExportServiceError);
        assert.equal(error.code, "EXPORT_FILE_MISSING");
        return true;
      },
    );
  });
});

describe("profile-service experiences and awards crud", () => {
  it("creates, updates, deletes, and user-isolates experience and award records", async () => {
    const state = {
      clockTick: 0,
      users: [
        {
          id: "user-1",
          email: "student@example.com",
        },
        {
          id: "user-2",
          email: "other@example.com",
        },
      ],
      userProfiles: [],
      educations: [],
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
      auditLogs: [],
    };

    globalThis.__testPrisma = createProfilePrismaMock(state);
    setModuleMocks([["@/lib/db", dbMockUrl]]);

    const { ProfileServiceError, profileService } = await importFreshModule(
      "src/services/profile-service.ts",
    );
    const createdExperience = await profileService.createExperience("user-1", {
      companyName: "Example Tech",
      jobTitle: "Frontend Intern",
      startDate: "2025-06",
      endDate: "2025-08",
      descriptionRaw: "Built dashboard modules",
      resultRaw: "Shipped 3 features",
    });
    const createdAward = await profileService.createAward("user-1", {
      title: "National Competition Finalist",
      issuer: "ACM",
      awardDate: "2025-11",
      description: "Top 5%",
    });

    assert.equal(createdExperience.companyName, "Example Tech");
    assert.equal(createdAward.title, "National Competition Finalist");

    const snapshotAfterCreate = await profileService.getProfileSnapshot("user-1");

    assert.equal(snapshotAfterCreate.counts.experiences, 1);
    assert.equal(snapshotAfterCreate.counts.awards, 1);

    const updatedExperience = await profileService.updateExperience(
      "user-1",
      createdExperience.id,
      {
        companyName: "Example Tech",
        jobTitle: "Frontend Engineer Intern",
        startDate: "2025-06",
        endDate: "2025-08",
        descriptionRaw: "Built dashboard and resume workflow",
        resultRaw: "Improved completion rate",
      },
    );
    const updatedAward = await profileService.updateAward("user-1", createdAward.id, {
      title: "National Competition Finalist",
      issuer: "ACM-ICPC",
      awardDate: "2025-11",
      description: "Top 3%",
    });

    assert.equal(updatedExperience.jobTitle, "Frontend Engineer Intern");
    assert.equal(updatedAward.issuer, "ACM-ICPC");

    await assert.rejects(
      () =>
        profileService.updateExperience("user-2", createdExperience.id, {
          companyName: "Blocked Corp",
          jobTitle: "Intern",
          startDate: "2025-01",
          endDate: "2025-02",
          descriptionRaw: "should fail",
          resultRaw: "",
        }),
      (error) => {
        assert.ok(error instanceof ProfileServiceError);
        assert.equal(error.code, "EXPERIENCE_NOT_FOUND");
        return true;
      },
    );

    await assert.rejects(
      () => profileService.deleteAward("user-2", createdAward.id),
      (error) => {
        assert.ok(error instanceof ProfileServiceError);
        assert.equal(error.code, "AWARD_NOT_FOUND");
        return true;
      },
    );

    await profileService.deleteExperience("user-1", createdExperience.id);
    await profileService.deleteAward("user-1", createdAward.id);

    const snapshotAfterDelete = await profileService.getProfileSnapshot("user-1");

    assert.equal(snapshotAfterDelete.counts.experiences, 0);
    assert.equal(snapshotAfterDelete.counts.awards, 0);
    assert.deepEqual(
      state.auditLogs.map((record) => record.actionType),
      [
        "EXPERIENCE_CREATED",
        "AWARD_CREATED",
        "EXPERIENCE_UPDATED",
        "AWARD_UPDATED",
        "EXPERIENCE_DELETED",
        "AWARD_DELETED",
      ],
    );
    assert.ok(state.auditLogs.every((record) => record.userId === "user-1"));
  });
});

describe("request logging minimal regression", () => {
  it("attaches an x-request-id header and writes a structured success log", async () => {
    const infoMessages = [];
    mock.method(console, "info", (message) => {
      infoMessages.push(message);
    });

    const { createApiRequestLogger } = await importFreshModule(
      "src/lib/monitoring/request-logger.ts",
    );
    const logger = createApiRequestLogger({
      request: new Request("http://localhost/api/health", {
        method: "GET",
      }),
      route: "GET /api/health",
      taskType: "health_check",
    });
    const response = logger.finalize({
      response: new Response(null, { status: 200 }),
      userId: "user-1",
      extra: {
        exportStatus: "success",
      },
    });
    const requestId = response.headers.get("x-request-id");
    const logPayload = JSON.parse(infoMessages[0]);

    assert.ok(requestId);
    assert.equal(logPayload.requestId, requestId);
    assert.equal(logPayload.taskType, "health_check");
    assert.equal(logPayload.success, true);
    assert.equal(logPayload.exportStatus, "success");
    assert.equal(typeof logPayload.latencyMs, "number");
  });
});

describe("resume-service version mutations", () => {
  function configureResumeServiceMocks(state) {
    globalThis.__testPrisma = createResumePrismaMock(state);
    globalThis.__testResumeDocument = {
      createEmptyResumeContent(input = {}) {
        return createResumeContent({
          basic: input,
          summary: "",
        });
      },
      renderResumeMarkdown(content) {
        return `markdown:${content.summary}`;
      },
    };
    globalThis.__testProfileService = {
      async getProfileSnapshot() {
        throw new Error("PROFILE_SERVICE_NOT_EXPECTED_IN_THIS_TEST");
      },
    };
    globalThis.__testResumeGeneratorAgent = {
      async generate() {
        throw new Error("RESUME_GENERATOR_NOT_EXPECTED_IN_THIS_TEST");
      },
    };

    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/resume-document", resumeDocumentMockUrl],
      ["@/services/profile-service", profileServiceMockUrl],
      ["@/ai/orchestrators/resume-generator-agent", resumeGeneratorAgentMockUrl],
    ]);
  }

  it("copies a historical version into a new current version without overwriting history", async () => {
    const state = createResumeState();

    configureResumeServiceMocks(state);

    const { resumeService } = await importFreshModule("src/services/resume-service.ts");
    const result = await resumeService.copyVersion("user-1", "resume-1", "version-master");

    const copiedVersion = state.versions.find((version) => version.id === result.createdVersionId);

    assert.ok(copiedVersion);
    assert.equal(state.versions.length, 3);
    assert.equal(copiedVersion.sourceVersionId, "version-master");
    assert.equal(copiedVersion.versionType, "MASTER");
    assert.equal(copiedVersion.createdBy, "MANUAL");
    assert.equal(result.sourceVersionId, "version-master");
    assert.equal(result.workspace.currentVersion.id, copiedVersion.id);
    assert.equal(result.workspace.versions[0].id, copiedVersion.id);
    assert.ok(state.versions.some((version) => version.id === "version-manual"));
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.auditLogs[0].actionType, "VERSION_CREATED");
    assert.equal(state.auditLogs[0].payload.action, "copy");
    assert.equal(state.auditLogs[1].actionType, "VERSION_COPIED");
  });

  it("rolls back to a historical version by creating a new current version", async () => {
    const state = createResumeState();

    configureResumeServiceMocks(state);

    const { resumeService } = await importFreshModule("src/services/resume-service.ts");
    const result = await resumeService.rollbackToVersion(
      "user-1",
      "resume-1",
      "version-master",
    );

    const rolledBackVersion = state.versions.find(
      (version) => version.id === result.createdVersionId,
    );

    assert.ok(rolledBackVersion);
    assert.equal(state.versions.length, 3);
    assert.equal(rolledBackVersion.sourceVersionId, "version-master");
    assert.equal(rolledBackVersion.versionType, "MASTER");
    assert.equal(rolledBackVersion.createdBy, "MANUAL");
    assert.equal(rolledBackVersion.contentJson.summary, "母版摘要");
    assert.equal(result.targetVersionId, "version-master");
    assert.equal(result.workspace.currentVersion.id, rolledBackVersion.id);
    assert.equal(result.workspace.currentVersion.contentJson.summary, "母版摘要");
    assert.ok(state.versions.some((version) => version.id === "version-manual"));
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.auditLogs[0].actionType, "VERSION_CREATED");
    assert.equal(state.auditLogs[0].payload.action, "rollback");
    assert.equal(state.auditLogs[1].actionType, "VERSION_ROLLED_BACK");
  });

  /* it("renames a version in place and records an audit trail", async () => {
    const state = createResumeState();

    configureResumeServiceMocks(state);

    const { resumeService } = await importFreshModule("src/services/resume-service.ts");
    const result = await resumeService.renameVersion(
      "user-1",
      "resume-1",
      "version-manual",
      "校招终稿 v2",
    );

    const renamedVersion = state.versions.find((version) => version.id === "version-manual");

    assert.equal(renamedVersion.versionName, "校招终稿 v2");
    assert.equal(result.updatedVersionId, "version-manual");
    assert.equal(
      result.workspace.versions.find((version) => version.id === "version-manual").versionName,
      "校招终稿 v2",
    );
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "VERSION_RENAMED");
    assert.equal(state.auditLogs[0].payload.previousVersionName, "鎵嬪姩缂栬緫 v2");
    assert.equal(state.auditLogs[0].payload.nextVersionName, "校招终稿 v2");
  }); */

  it("renames a version in place and records an audit trail", async () => {
    const state = createResumeState();

    configureResumeServiceMocks(state);

    const { resumeService } = await importFreshModule("src/services/resume-service.ts");
    const result = await resumeService.renameVersion(
      "user-1",
      "resume-1",
      "version-manual",
      "校招终稿 v2",
    );

    const renamedVersion = state.versions.find((version) => version.id === "version-manual");

    assert.equal(renamedVersion.versionName, "校招终稿 v2");
    assert.equal(result.updatedVersionId, "version-manual");
    assert.equal(
      result.workspace.versions.find((version) => version.id === "version-manual").versionName,
      "校招终稿 v2",
    );
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "VERSION_RENAMED");
    assert.equal(state.auditLogs[0].payload.previousVersionName, "手动编辑 v2");
    assert.equal(state.auditLogs[0].payload.nextVersionName, "校招终稿 v2");
  });

  it("deletes a historical version without leaking across users and detaches derived links", async () => {
    const state = createResumeState();

    configureResumeServiceMocks(state);

    const { resumeService } = await importFreshModule("src/services/resume-service.ts");
    const result = await resumeService.deleteVersion(
      "user-1",
      "resume-1",
      "version-master",
    );

    assert.equal(state.versions.length, 1);
    assert.equal(state.versions[0].id, "version-manual");
    assert.equal(state.versions[0].sourceVersionId, null);
    assert.equal(result.deletedVersionId, "version-master");
    assert.equal(result.deletedWasCurrent, false);
    assert.equal(result.workspace.currentVersion.id, "version-manual");
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0].actionType, "VERSION_DELETED");
    assert.equal(state.auditLogs[0].payload.derivedVersionsDetachedCount, 1);
  });

  it("blocks deleting the last remaining version", async () => {
    const state = createResumeState();
    state.versions = [state.versions[0]];

    configureResumeServiceMocks(state);

    const { ResumeServiceError, resumeService } = await importFreshModule(
      "src/services/resume-service.ts",
    );

    await assert.rejects(
      () => resumeService.deleteVersion("user-1", "resume-1", "version-master"),
      (error) => {
        assert.ok(error instanceof ResumeServiceError);
        assert.equal(error.code, "LAST_VERSION_DELETE_FORBIDDEN");
        return true;
      },
    );
  });
});

/* describe("resume-diagnosis apply suggestions", () => {
  it("creates a new ai_rewrite version and records audit logs", async () => {
    const state = {
      clockTick: 1,
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
          name: "娴嬭瘯绠€鍘?,
          status: "ACTIVE",
          updatedAt: new Date("2026-03-20T09:00:01Z"),
        },
      ],
      versions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "姣嶇増 v1",
          versionType: "MASTER",
          sourceVersionId: null,
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "markdown:鍘熷鎽樿",
          contentJson: createResumeContent({
            summary: "鍘熷鎽樿",
          }),
          changeSummary: null,
          status: "READY",
          createdBy: "AI_GENERATE",
          createdAt: new Date("2026-03-20T09:00:01Z"),
          updatedAt: new Date("2026-03-20T09:00:01Z"),
        },
      ],
      diagnosisReports: [
        {
          id: "report-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          inputJdAnalysisId: null,
          scoreOverview: {
            overall: 82,
            content: 80,
            expression: 84,
            structure: 82,
            match: 81,
            ats: 83,
            summary: "good",
          },
          issues: [],
          suggestions: [
            {
              id: "suggestion-1",
              category: "expression",
              title: "Rewrite summary",
              rationale: "Make the opening line more direct",
              actionText: "Apply rewrite",
              canAutoApply: true,
              requiresUserConfirmation: false,
              issueIds: ["issue-1"],
              patch: {
                actionType: "rewrite_summary",
                summary: "鏇存柊鍚庣殑鎽樿",
              },
            },
          ],
          modelName: "test-model",
          createdAt: new Date("2026-03-20T09:10:00Z"),
        },
      ],
      auditLogs: [],
    };

    function mapVersionType(type) {
      switch (type) {
        case "MASTER":
          return "master";
        case "JOB_TARGETED":
          return "job_targeted";
        case "AI_REWRITE":
          return "ai_rewrite";
        default:
          return "manual";
      }
    }

    function mapCreatedBy(type) {
      switch (type) {
        case "AI_GENERATE":
          return "ai_generate";
        case "AI_OPTIMIZE":
          return "ai_optimize";
        case "AI_DIAGNOSE_APPLY":
          return "ai_diagnose_apply";
        default:
          return "manual";
      }
    }

    globalThis.__testPrisma = {
      resumeVersion: {
        async findFirst({ where, include }) {
          const version =
            state.versions.find((item) => {
              return (
                (!where.id || item.id === where.id) &&
                (!where.resumeId || item.resumeId === where.resumeId) &&
                (!where.userId || item.userId === where.userId)
              );
            }) ?? null;

          if (!version) {
            return null;
          }

          if (include?.resume?.include?._count?.select?.versions) {
            return {
              ...cloneValue(version),
              resume: {
                _count: {
                  versions: state.versions.filter(
                    (item) => item.resumeId === version.resumeId,
                  ).length,
                },
              },
            };
          }

          return cloneValue(version);
        },
      },
      resume: {
        async findFirst({ where, select }) {
          const resume =
            state.resumes.find((item) => {
              return (
                (!where.id || item.id === where.id) &&
                (!where.userId || item.userId === where.userId)
              );
            }) ?? null;

          if (!resume) {
            return null;
          }

          return select ? pickFields(resume, select) : cloneValue(resume);
        },
      },
      diagnosisReport: {
        async findFirst({ where }) {
          return (
            state.diagnosisReports.find((report) => {
              return (
                (!where.id || report.id === where.id) &&
                (!where.userId || report.userId === where.userId) &&
                (!where.resumeVersionId ||
                  report.resumeVersionId === where.resumeVersionId)
              );
            }) ?? null
          );
        },
      },
      $transaction(callback) {
        return callback({
          resumeVersion: {
            async create({ data }) {
              const createdAt = nextDate(state);
              const createdVersion = {
                id: `version-${state.versions.length + 1}`,
                resumeId: data.resumeId,
                userId: data.userId,
                versionName: data.versionName,
                versionType: data.versionType,
                sourceVersionId: data.sourceVersionId ?? null,
                jobTargetTitle: data.jobTargetTitle ?? null,
                jobTargetCompany: data.jobTargetCompany ?? null,
                contentMarkdown: data.contentMarkdown,
                contentJson: cloneValue(data.contentJson),
                changeSummary: cloneValue(data.changeSummary ?? null),
                status: data.status,
                createdBy: data.createdBy,
                createdAt,
                updatedAt: createdAt,
              };

              state.versions.push(createdVersion);
              return cloneValue(createdVersion);
            },
          },
          auditLog: {
            async create({ data }) {
              state.auditLogs.push(cloneValue(data));
              return cloneValue(data);
            },
          },
        });
      },
    };
    globalThis.__testResumeDocument = {
      createEmptyResumeContent(input = {}) {
        return createResumeContent({
          basic: input,
          summary: "",
        });
      },
      renderResumeMarkdown(content) {
        return `markdown:${content.summary}`;
      },
      formatResumeDate(value) {
        return value;
      },
    };
    globalThis.__testResumeService = {
      async getResumeWorkspace() {
        const sortedVersions = [...state.versions].sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        );

        return {
          resume: {
            id: "resume-1",
            name: "娴嬭瘯绠€鍘?,
            status: "active",
            updatedAt: state.resumes[0].updatedAt.toISOString(),
            totalVersions: sortedVersions.length,
            currentVersion: null,
          },
          versions: sortedVersions.map((version) => ({
            id: version.id,
            resumeId: version.resumeId,
            versionName: version.versionName,
            versionType: mapVersionType(version.versionType),
            status: "ready",
            sourceVersionId: version.sourceVersionId,
            jobTargetTitle: version.jobTargetTitle,
            jobTargetCompany: version.jobTargetCompany,
            contentMarkdown: version.contentMarkdown,
            contentJson: cloneValue(version.contentJson),
            changeSummary: cloneValue(version.changeSummary),
            createdBy: mapCreatedBy(version.createdBy),
            createdAt: version.createdAt.toISOString(),
            updatedAt: version.updatedAt.toISOString(),
          })),
          currentVersion: null,
          styles: [],
        };
      },
    };

    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/resume-document", resumeDocumentMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const { resumeDiagnosisService } = await importFreshModule(
      "src/services/resume-diagnosis-service.ts",
    );
    const result = await resumeDiagnosisService.applySuggestions({
      userId: "user-1",
      resumeId: "resume-1",
      resumeVersionId: "version-1",
      reportId: "report-1",
      suggestionIds: ["suggestion-1"],
    });
    const createdVersion = state.versions.find((version) => version.id === "version-2");

    assert.ok(createdVersion);
    assert.equal(createdVersion.versionType, "AI_REWRITE");
    assert.equal(createdVersion.createdBy, "AI_DIAGNOSE_APPLY");
    assert.equal(createdVersion.contentJson.summary, "鏇存柊鍚庣殑鎽樿");
    assert.deepEqual(result.appliedSuggestionIds, ["suggestion-1"]);
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.auditLogs[0].actionType, "VERSION_CREATED");
    assert.equal(state.auditLogs[1].actionType, "DIAGNOSIS_SUGGESTIONS_APPLIED");
  });
});

*/

describe("resume-diagnosis apply suggestions", () => {
  it("creates a new ai_rewrite version and records audit logs", async () => {
    const state = {
      clockTick: 1,
      resumes: [
        {
          id: "resume-1",
          userId: "user-1",
          name: "Diagnosis Resume",
          status: "ACTIVE",
          updatedAt: new Date("2026-03-20T09:00:01Z"),
        },
      ],
      versions: [
        {
          id: "version-1",
          resumeId: "resume-1",
          userId: "user-1",
          versionName: "Master v1",
          versionType: "MASTER",
          sourceVersionId: null,
          jobTargetTitle: null,
          jobTargetCompany: null,
          contentMarkdown: "markdown:Original summary",
          contentJson: createResumeContent({
            summary: "Original summary",
          }),
          changeSummary: null,
          status: "READY",
          createdBy: "AI_GENERATE",
          createdAt: new Date("2026-03-20T09:00:01Z"),
          updatedAt: new Date("2026-03-20T09:00:01Z"),
        },
      ],
      diagnosisReports: [
        {
          id: "report-1",
          userId: "user-1",
          resumeVersionId: "version-1",
          inputJdAnalysisId: null,
          scoreOverview: {
            overall: 82,
            content: 80,
            expression: 84,
            structure: 82,
            match: 81,
            ats: 83,
            summary: "good",
          },
          issues: [],
          suggestions: [
            {
              id: "suggestion-1",
              category: "expression",
              title: "Rewrite summary",
              rationale: "Make the opening line more direct",
              actionText: "Apply rewrite",
              canAutoApply: true,
              requiresUserConfirmation: false,
              issueIds: ["issue-1"],
              patch: {
                actionType: "rewrite_summary",
                summary: "Updated summary after diagnosis apply",
              },
            },
          ],
          modelName: "test-model",
          createdAt: new Date("2026-03-20T09:10:00Z"),
        },
      ],
      auditLogs: [],
    };

    function mapVersionType(type) {
      switch (type) {
        case "MASTER":
          return "master";
        case "JOB_TARGETED":
          return "job_targeted";
        case "AI_REWRITE":
          return "ai_rewrite";
        default:
          return "manual";
      }
    }

    function mapCreatedBy(type) {
      switch (type) {
        case "AI_GENERATE":
          return "ai_generate";
        case "AI_OPTIMIZE":
          return "ai_optimize";
        case "AI_DIAGNOSE_APPLY":
          return "ai_diagnose_apply";
        default:
          return "manual";
      }
    }

    globalThis.__testPrisma = {
      resumeVersion: {
        async findFirst({ where, include }) {
          const version =
            state.versions.find((item) => {
              return (
                (!where.id || item.id === where.id) &&
                (!where.resumeId || item.resumeId === where.resumeId) &&
                (!where.userId || item.userId === where.userId)
              );
            }) ?? null;

          if (!version) {
            return null;
          }

          if (include?.resume?.include?._count?.select?.versions) {
            return {
              ...cloneValue(version),
              resume: {
                _count: {
                  versions: state.versions.filter(
                    (item) => item.resumeId === version.resumeId,
                  ).length,
                },
              },
            };
          }

          return cloneValue(version);
        },
      },
      resume: {
        async findFirst({ where, select }) {
          const resume =
            state.resumes.find((item) => {
              return (
                (!where.id || item.id === where.id) &&
                (!where.userId || item.userId === where.userId)
              );
            }) ?? null;

          if (!resume) {
            return null;
          }

          return select ? pickFields(resume, select) : cloneValue(resume);
        },
      },
      diagnosisReport: {
        async findFirst({ where }) {
          return (
            state.diagnosisReports.find((report) => {
              return (
                (!where.id || report.id === where.id) &&
                (!where.userId || report.userId === where.userId) &&
                (!where.resumeVersionId ||
                  report.resumeVersionId === where.resumeVersionId)
              );
            }) ?? null
          );
        },
      },
      $transaction(callback) {
        return callback({
          resumeVersion: {
            async create({ data }) {
              const createdAt = nextDate(state);
              const createdVersion = {
                id: `version-${state.versions.length + 1}`,
                resumeId: data.resumeId,
                userId: data.userId,
                versionName: data.versionName,
                versionType: data.versionType,
                sourceVersionId: data.sourceVersionId ?? null,
                jobTargetTitle: data.jobTargetTitle ?? null,
                jobTargetCompany: data.jobTargetCompany ?? null,
                contentMarkdown: data.contentMarkdown,
                contentJson: cloneValue(data.contentJson),
                changeSummary: cloneValue(data.changeSummary ?? null),
                status: data.status,
                createdBy: data.createdBy,
                createdAt,
                updatedAt: createdAt,
              };

              state.versions.push(createdVersion);
              return cloneValue(createdVersion);
            },
          },
          auditLog: {
            async create({ data }) {
              state.auditLogs.push(cloneValue(data));
              return cloneValue(data);
            },
          },
        });
      },
    };
    globalThis.__testResumeDocument = {
      createEmptyResumeContent(input = {}) {
        return createResumeContent({
          basic: input,
          summary: "",
        });
      },
      renderResumeMarkdown(content) {
        return `markdown:${content.summary}`;
      },
    };
    globalThis.__testResumeService = {
      async getResumeWorkspace() {
        const sortedVersions = [...state.versions].sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        );
        const mappedVersions = sortedVersions.map((version) => ({
          id: version.id,
          resumeId: version.resumeId,
          versionName: version.versionName,
          versionType: mapVersionType(version.versionType),
          status: "ready",
          sourceVersionId: version.sourceVersionId,
          jobTargetTitle: version.jobTargetTitle,
          jobTargetCompany: version.jobTargetCompany,
          contentMarkdown: version.contentMarkdown,
          contentJson: cloneValue(version.contentJson),
          changeSummary: cloneValue(version.changeSummary),
          createdBy: mapCreatedBy(version.createdBy),
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        }));

        return {
          resume: {
            id: "resume-1",
            name: "Diagnosis Resume",
            status: "active",
            updatedAt: state.resumes[0].updatedAt.toISOString(),
            totalVersions: mappedVersions.length,
            currentVersion: mappedVersions[0] ?? null,
          },
          versions: mappedVersions,
          currentVersion: mappedVersions[0] ?? null,
          styles: [],
        };
      },
    };

    setModuleMocks([
      ["@/lib/db", dbMockUrl],
      ["@/lib/resume-document", resumeDocumentMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const { resumeDiagnosisService } = await importFreshModule(
      "src/services/resume-diagnosis-service.ts",
    );
    const result = await resumeDiagnosisService.applySuggestions({
      userId: "user-1",
      resumeId: "resume-1",
      resumeVersionId: "version-1",
      reportId: "report-1",
      suggestionIds: ["suggestion-1"],
    });
    const createdVersion = state.versions.find((version) => version.id === "version-2");

    assert.ok(createdVersion);
    assert.equal(createdVersion.versionType, "AI_REWRITE");
    assert.equal(createdVersion.createdBy, "AI_DIAGNOSE_APPLY");
    assert.equal(
      createdVersion.contentJson.summary,
      "Updated summary after diagnosis apply",
    );
    assert.deepEqual(result.appliedSuggestionIds, ["suggestion-1"]);
    assert.equal(result.workspace.currentVersion.id, "version-2");
    assert.equal(state.auditLogs.length, 2);
    assert.equal(state.auditLogs[0].actionType, "VERSION_CREATED");
    assert.equal(state.auditLogs[1].actionType, "DIAGNOSIS_SUGGESTIONS_APPLIED");
  });
});

/* describe("route smoke tests", () => {
  function createRouteApiMocks(userId = "user-1") {
    globalThis.__testLibApiResume = {
      async getAuthenticatedResumeUserId() {
        return userId;
      },
      getResumeApiErrorResponse(error) {
        return Response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "unknown_error",
            },
          },
          { status: 500 },
        );
      },
    };
  }

  it("POST /api/exports/[exportId]/retry delegates to exportService.retryExport", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testExportService = {
      async retryExport(input) {
        capturedInput = input;

        return {
          id: "export-retried",
          resumeId: "resume-1",
          resumeVersionId: "version-1",
          resumeVersionName: "母版 v1",
          resumeVersionType: "master",
          jobTargetTitle: null,
          jobTargetCompany: null,
          exportType: "pdf",
          templateName: "ats-standard",
          status: "success",
          fileUrl: "/api/exports/export-retried",
          fileSize: 2048,
          createdAt: "2026-03-20T10:00:00.000Z",
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/retry/route.ts",
    );
    const response = await routeModule.POST(new Request("http://localhost/api/exports/export-1/retry", {
      method: "POST",
    }), {
      params: Promise.resolve({
        exportId: "export-1",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      exportId: "export-1",
    });
    assert.equal(payload.success, true);
    assert.equal(payload.data.id, "export-retried");
  });

  it("GET /api/exports/[exportId] delegates to exportService.getExportDownload and returns x-request-id", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testExportService = {
      async getExportDownload(input) {
        capturedInput = input;

        return {
          exportId: "export-1",
          resumeId: "resume-1",
          resumeVersionId: "version-1",
          exportType: "markdown",
          exportStatus: "success",
          templateName: "source-markdown",
          fileNameAscii: "resume-export-export-1.md",
          fileNameUtf8: "母版 v1.md",
          content: "# Resume",
          contentType: "text/markdown; charset=utf-8",
          fileSize: 8,
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/route.ts",
    );
    const response = await routeModule.GET(
      new Request("http://localhost/api/exports/export-1", {
        method: "GET",
      }),
      {
        params: Promise.resolve({
          exportId: "export-1",
        }),
      },
    );

    assert.equal(response.status, 200);
    assert.equal(capturedInput.userId, "user-1");
    assert.equal(capturedInput.exportId, "export-1");
    assert.ok(capturedInput.requestId);
    assert.equal(response.headers.get("x-request-id"), capturedInput.requestId);
    assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  });

  it("POST /api/exports/[exportId]/retry blocks unauthenticated access", async () => {
    createRouteApiMocks(null);
    globalThis.__testExportService = {
      async retryExport() {
        throw new Error("should_not_be_called");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/retry/route.ts",
    );
    const response = await routeModule.POST(new Request("http://localhost/api/exports/export-1/retry", {
      method: "POST",
    }), {
      params: Promise.resolve({
        exportId: "export-1",
      }),
    });

    assert.equal(response.status, 401);
  });

  it("POST /api/resumes/[resumeId]/versions/[versionId]/copy delegates to resumeService.copyVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async copyVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "测试简历",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 3,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          createdVersionId: "version-3",
          sourceVersionId: "version-1",
        };
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/copy/route.ts",
    );
    const response = await routeModule.POST(new Request("http://localhost/api/resumes/resume-1/versions/version-1/copy", {
      method: "POST",
    }), {
      params: Promise.resolve({
        resumeId: "resume-1",
        versionId: "version-1",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.createdVersionId, "version-3");
  });

  it("POST /api/resumes/[resumeId]/versions/[versionId]/rollback delegates to resumeService.rollbackToVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "测试简历",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 3,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          createdVersionId: "version-rollback-3",
          targetVersionId: "version-1",
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/rollback/route.ts",
    );
    const response = await routeModule.POST(new Request("http://localhost/api/resumes/resume-1/versions/version-1/rollback", {
      method: "POST",
    }), {
      params: Promise.resolve({
        resumeId: "resume-1",
        versionId: "version-1",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.createdVersionId, "version-rollback-3");
  });

  it("PATCH /api/resumes/[resumeId]/versions/[versionId] delegates to resumeService.renameVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async renameVersion(userId, resumeId, versionId, versionName) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
          versionName,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "娴嬭瘯绠€鍘?,
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 2,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          updatedVersionId: "version-1",
        };
      },
      async deleteVersion() {
        throw new Error("unexpected_delete_call");
      },
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
      async saveManualVersion() {
        throw new Error("unexpected_save_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/route.ts",
    );
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionName: "校招终稿 v2",
        }),
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
      versionName: "校招终稿 v2",
    });
    assert.equal(payload.data.updatedVersionId, "version-1");
  });

  it("DELETE /api/resumes/[resumeId]/versions/[versionId] delegates to resumeService.deleteVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async deleteVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "娴嬭瘯绠€鍘?,
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 1,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          deletedVersionId: "version-1",
          deletedWasCurrent: true,
        };
      },
      async renameVersion() {
        throw new Error("unexpected_rename_call");
      },
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
      async saveManualVersion() {
        throw new Error("unexpected_save_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/route.ts",
    );
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.deletedVersionId, "version-1");
    assert.equal(payload.data.deletedWasCurrent, true);
  });
});
*/

describe("route smoke tests", () => {
  function createRouteApiMocks(userId = "user-1") {
    globalThis.__testLibApiResume = {
      async getAuthenticatedResumeUserId() {
        return userId;
      },
      getResumeApiErrorResponse(error) {
        return Response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "unknown_error",
            },
          },
          { status: 500 },
        );
      },
      };
  }

  function createCommercialApiMocks({
    userId = "user-1",
    callbackAuthorized = false,
  } = {}) {
    globalThis.__testLibApiCommercial = {
      async getAuthenticatedCommercialUserId() {
        return userId;
      },
      hasValidCommerceCallbackSecret() {
        return callbackAuthorized;
      },
      getCommercialApiErrorResponse(error) {
        return Response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "unknown_error",
            },
          },
          { status: 500 },
        );
      },
    };
  }

  it("POST /api/exports/[exportId]/retry delegates to exportService.retryExport", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testExportService = {
      async retryExport(input) {
        capturedInput = input;

        return {
          id: "export-retried",
          resumeId: "resume-1",
          resumeVersionId: "version-1",
          resumeVersionName: "Master v1",
          resumeVersionType: "master",
          jobTargetTitle: null,
          jobTargetCompany: null,
          exportType: "pdf",
          templateName: "ats-standard",
          status: "success",
          fileUrl: "/api/exports/export-retried",
          fileSize: 2048,
          createdAt: "2026-03-20T10:00:00.000Z",
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/retry/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/exports/export-1/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          exportId: "export-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      exportId: "export-1",
    });
    assert.equal(payload.success, true);
    assert.equal(payload.data.id, "export-retried");
  });

  it("GET /api/exports/[exportId] delegates to exportService.getExportDownload and returns x-request-id", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testExportService = {
      async getExportDownload(input) {
        capturedInput = input;

        return {
          exportId: "export-1",
          resumeId: "resume-1",
          resumeVersionId: "version-1",
          exportType: "markdown",
          exportStatus: "success",
          templateName: "source-markdown",
          fileNameAscii: "resume-export-export-1.md",
          fileNameUtf8: "master-v1.md",
          content: "# Resume",
          contentType: "text/markdown; charset=utf-8",
          fileSize: 8,
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/route.ts",
    );
    const response = await routeModule.GET(
      new Request("http://localhost/api/exports/export-1", {
        method: "GET",
      }),
      {
        params: Promise.resolve({
          exportId: "export-1",
        }),
      },
    );

    assert.equal(response.status, 200);
    assert.equal(capturedInput.userId, "user-1");
    assert.equal(capturedInput.exportId, "export-1");
    assert.ok(capturedInput.requestId);
    assert.equal(response.headers.get("x-request-id"), capturedInput.requestId);
    assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  });

  it("POST /api/exports/[exportId]/retry blocks unauthenticated access", async () => {
    createRouteApiMocks(null);
    globalThis.__testExportService = {
      async retryExport() {
        throw new Error("should_not_be_called");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/export-service", exportServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/exports/[exportId]/retry/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/exports/export-1/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          exportId: "export-1",
        }),
      },
    );

    assert.equal(response.status, 401);
  });

  it("POST /api/resumes/[resumeId]/versions/[versionId]/copy delegates to resumeService.copyVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async copyVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "Test Resume",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 3,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          createdVersionId: "version-3",
          sourceVersionId: "version-1",
        };
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/copy/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1/copy", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.createdVersionId, "version-3");
  });

  it("POST /api/resumes/[resumeId]/versions/[versionId]/rollback delegates to resumeService.rollbackToVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "Test Resume",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 3,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          createdVersionId: "version-rollback-3",
          targetVersionId: "version-1",
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/rollback/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1/rollback", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.createdVersionId, "version-rollback-3");
  });

  it("PATCH /api/resumes/[resumeId]/versions/[versionId] delegates to resumeService.renameVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async renameVersion(userId, resumeId, versionId, versionName) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
          versionName,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "Test Resume",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 2,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          updatedVersionId: "version-1",
        };
      },
      async deleteVersion() {
        throw new Error("unexpected_delete_call");
      },
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
      async saveManualVersion() {
        throw new Error("unexpected_save_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/route.ts",
    );
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionName: "Campus Version v2",
        }),
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
      versionName: "Campus Version v2",
    });
    assert.equal(payload.data.updatedVersionId, "version-1");
  });

  it("DELETE /api/resumes/[resumeId]/versions/[versionId] delegates to resumeService.deleteVersion", async () => {
    createRouteApiMocks();

    let capturedInput = null;
    globalThis.__testResumeService = {
      async deleteVersion(userId, resumeId, versionId) {
        capturedInput = {
          userId,
          resumeId,
          versionId,
        };

        return {
          workspace: {
            resume: {
              id: "resume-1",
              name: "Test Resume",
              status: "active",
              updatedAt: "2026-03-20T10:00:00.000Z",
              totalVersions: 1,
              currentVersion: null,
            },
            versions: [],
            currentVersion: null,
            styles: [],
          },
          deletedVersionId: "version-1",
          deletedWasCurrent: true,
        };
      },
      async renameVersion() {
        throw new Error("unexpected_rename_call");
      },
      async copyVersion() {
        throw new Error("unexpected_copy_call");
      },
      async rollbackToVersion() {
        throw new Error("unexpected_rollback_call");
      },
      async saveManualVersion() {
        throw new Error("unexpected_save_call");
      },
    };

    setModuleMocks([
      ["@/lib/api/resume", resumeApiMockUrl],
      ["@/services/resume-service", resumeServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/resumes/[resumeId]/versions/[versionId]/route.ts",
    );
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/resumes/resume-1/versions/version-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          resumeId: "resume-1",
          versionId: "version-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      resumeId: "resume-1",
      versionId: "version-1",
    });
    assert.equal(payload.data.deletedVersionId, "version-1");
    assert.equal(payload.data.deletedWasCurrent, true);
  });

  it("POST /api/commerce/checkout delegates to commercialAccessService.createCheckoutOrder", async () => {
    createCommercialApiMocks();

    let capturedInput = null;
    globalThis.__testCommercialAccessService = {
      async createCheckoutOrder(input) {
        capturedInput = input;

        return {
          order: {
            id: "commerce-order-1",
            planCode: "jd_diagnose_pack_29",
            amountCents: 2900,
            currency: "CNY",
            status: "pending",
            paymentChannel: "wechat",
            externalOrderId: null,
            paidAt: null,
            createdAt: "2026-03-20T10:00:00.000Z",
            paymentSession: {
              channel: "wechat",
              status: "ready",
              expiresAt: "2026-03-20T10:30:00.000Z",
              codeUrl: "weixin://wxpay/mock",
              paymentUrl: "weixin://wxpay/mock",
              qrCodeDataUrl: "data:image/png;base64,mock",
              displayTitle: "微信支付二维码",
              displayDescription: "mock",
            },
          },
          profile: {
            accessTier: "trial",
            planCode: "trial",
            planLabel: "免费试用",
            amountCents: 0,
            currentAiModel: "gpt-5.1",
            quotas: {
              masterResumeCreditsRemaining: 1,
              jdTailorCreditsRemaining: 1,
              diagnosisCreditsRemaining: 1,
              pdfExportCreditsRemaining: 1,
              hasUnlimitedExports: false,
            },
            activatedAt: null,
          },
          plan: {
            code: "jd_diagnose_pack_29",
            label: "29 元 JD 定制 / 诊断冲刺包",
            amountCents: 2900,
            currentAiModel: "gpt-5.4",
            masterResumeCredits: 0,
            jdTailorCredits: 10,
            diagnosisCredits: 10,
            pdfExportCredits: null,
            hasUnlimitedExports: true,
          },
          reusedExistingOrder: false,
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/commercial", commercialApiMockUrl],
      ["@/services/commercial-access-service", commercialAccessServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/commerce/checkout/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/commerce/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planCode: "jd_diagnose_pack_29",
          paymentChannel: "wechat",
        }),
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(capturedInput, {
      userId: "user-1",
      planCode: "jd_diagnose_pack_29",
      paymentChannel: "wechat",
    });
    assert.equal(payload.data.order.id, "commerce-order-1");
  });

  it("POST /api/commerce/orders/[orderId]/confirm delegates to commercialAccessService.confirmOrderPaid", async () => {
    createCommercialApiMocks({
      userId: "user-1",
      callbackAuthorized: false,
    });

    let capturedInput = null;
    globalThis.__testCommercialAccessService = {
      async confirmOrderPaid(input) {
        capturedInput = input;

        return {
          order: {
            id: "commerce-order-1",
            planCode: "jd_diagnose_pack_29",
            amountCents: 2900,
            currency: "CNY",
            status: "manual_granted",
            paymentChannel: "wechat",
            externalOrderId: "wx_001",
            paidAt: "2026-03-20T10:05:00.000Z",
            createdAt: "2026-03-20T10:00:00.000Z",
            paymentSession: null,
          },
          profile: {
            accessTier: "paid",
            planCode: "jd_diagnose_pack_29",
            planLabel: "29 元 JD 定制 / 诊断冲刺包",
            amountCents: 2900,
            currentAiModel: "gpt-5.4",
            quotas: {
              masterResumeCreditsRemaining: 1,
              jdTailorCreditsRemaining: 11,
              diagnosisCreditsRemaining: 11,
              pdfExportCreditsRemaining: null,
              hasUnlimitedExports: true,
            },
            activatedAt: "2026-03-20T10:05:00.000Z",
          },
          alreadyProcessed: false,
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/commercial", commercialApiMockUrl],
      ["@/services/commercial-access-service", commercialAccessServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/commerce/orders/[orderId]/confirm/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/commerce/orders/commerce-order-1/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentChannel: "wechat",
          externalOrderId: "wx_001",
        }),
      }),
      {
        params: Promise.resolve({
          orderId: "commerce-order-1",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(capturedInput, {
      orderId: "commerce-order-1",
      userId: "user-1",
      paymentChannel: "wechat",
      externalOrderId: "wx_001",
      notes: undefined,
      paidStatus: "MANUAL_GRANTED",
    });
    assert.equal(payload.data.profile.accessTier, "paid");
    assert.equal(payload.data.order.status, "manual_granted");
  });

  it("POST /api/payments/wechat/notify confirms paid order after callback verification", async () => {
    createCommercialApiMocks();

    let confirmInput = null;
    globalThis.__testPaymentService = {
      async handleWechatCallback() {
        return {
          handled: true,
          orderId: "commerce-order-1",
          paymentChannel: "wechat",
          externalOrderId: "wx_txn_001",
        };
      },
    };
    globalThis.__testCommercialAccessService = {
      async confirmOrderPaid(input) {
        confirmInput = input;

        return {
          order: {
            id: "commerce-order-1",
          },
        };
      },
    };

    setModuleMocks([
      ["@/lib/api/commercial", commercialApiMockUrl],
      ["@/services/payment-service", paymentServiceMockUrl],
      ["@/services/commercial-access-service", commercialAccessServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/payments/wechat/notify/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/payments/wechat/notify", {
        method: "POST",
        body: JSON.stringify({ id: "evt_1" }),
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(confirmInput, {
      orderId: "commerce-order-1",
      paymentChannel: "wechat",
      externalOrderId: "wx_txn_001",
      notes: "wechat_notify_paid",
      paidStatus: "PAID",
    });
    assert.equal(payload.code, "SUCCESS");
  });

  it("POST /api/payments/alipay/notify confirms paid order after callback verification", async () => {
    let confirmInput = null;
    globalThis.__testPaymentService = {
      async handleAlipayCallback() {
        return {
          handled: true,
          orderId: "commerce-order-2",
          paymentChannel: "alipay",
          externalOrderId: "ali_txn_001",
        };
      },
    };
    globalThis.__testCommercialAccessService = {
      async confirmOrderPaid(input) {
        confirmInput = input;

        return {
          order: {
            id: "commerce-order-2",
          },
        };
      },
    };

    setModuleMocks([
      ["@/services/payment-service", paymentServiceMockUrl],
      ["@/services/commercial-access-service", commercialAccessServiceMockUrl],
    ]);

    const routeModule = await importFreshModule(
      "src/app/api/payments/alipay/notify/route.ts",
    );
    const response = await routeModule.POST(
      new Request("http://localhost/api/payments/alipay/notify", {
        method: "POST",
        body: "trade_status=TRADE_SUCCESS",
      }),
    );
    const payload = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(confirmInput, {
      orderId: "commerce-order-2",
      paymentChannel: "alipay",
      externalOrderId: "ali_txn_001",
      notes: "alipay_notify_paid",
      paidStatus: "PAID",
    });
    assert.equal(payload, "success");
  });
});
