import { getAuthSession } from "@/auth";
import { apiError } from "@/lib/http";
import { captureServerException } from "@/lib/monitoring/sentry";
import { CommercialAccessServiceError } from "@/services/commercial-access-service";
import { ExportServiceError } from "@/services/export-service";
import { JDAnalysisServiceError } from "@/services/jd-analysis-service";
import { ResumeDiagnosisServiceError } from "@/services/resume-diagnosis-service";
import { ResumeOptimizationServiceError } from "@/services/resume-optimization-service";
import { ResumeServiceError } from "@/services/resume-service";

export async function getAuthenticatedResumeUserId() {
  const session = await getAuthSession();

  return session?.user?.id ?? null;
}

export function getResumeApiErrorResponse(error: unknown) {
  if (error instanceof ResumeServiceError) {
    switch (error.code) {
      case "PROFILE_INCOMPLETE":
        return apiError("请先补齐建档必填模块后再生成母版简历。", 400, {
          missingModules: error.details ?? [],
        });
      case "RESUME_NOT_FOUND":
        return apiError("简历不存在或无权访问。", 404);
      case "VERSION_NOT_FOUND":
        return apiError("简历版本不存在或无权访问。", 404);
      case "VERSION_ALREADY_CURRENT":
        return apiError("所选版本已经是当前版本，无需重复回滚。", 400);
      case "LAST_VERSION_DELETE_FORBIDDEN":
        return apiError("简历至少需要保留 1 个版本，请先创建副本后再删除。", 409);
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ResumeServiceError",
            code: error.code,
          },
        });
        return apiError("简历操作失败，请稍后重试。", 500);
    }
  }

  if (error instanceof JDAnalysisServiceError) {
    switch (error.code) {
      case "RESUME_NOT_FOUND":
        return apiError("简历不存在或无权访问。", 404);
      case "VERSION_NOT_FOUND":
        return apiError("简历版本不存在或无权访问。", 404);
      case "JD_ANALYSIS_NOT_FOUND":
        return apiError("JD 解析结果不存在或无权访问。", 404);
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "JDAnalysisServiceError",
            code: error.code,
          },
        });
        return apiError("JD 解析失败，请稍后重试。", 500);
    }
  }

  if (error instanceof ResumeOptimizationServiceError) {
    switch (error.code) {
      case "RESUME_NOT_FOUND":
        return apiError("简历不存在或无权访问。", 404);
      case "VERSION_NOT_FOUND":
        return apiError("简历版本不存在或无权访问。", 404);
      case "JD_ANALYSIS_NOT_FOUND":
        return apiError("请先完成 JD 解析后再生成岗位版简历。", 404);
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ResumeOptimizationServiceError",
            code: error.code,
          },
        });
        return apiError("岗位版简历生成失败，请稍后重试。", 500);
    }
  }

  if (error instanceof ResumeDiagnosisServiceError) {
    switch (error.code) {
      case "RESUME_NOT_FOUND":
        return apiError("简历不存在或无权访问。", 404);
      case "VERSION_NOT_FOUND":
        return apiError("简历版本不存在或无权访问。", 404);
      case "JD_ANALYSIS_NOT_FOUND":
        return apiError("关联的 JD 解析结果不存在或无权访问。", 404);
      case "DIAGNOSIS_NOT_FOUND":
        return apiError("诊断报告不存在或无权访问。", 404);
      case "NO_APPLICABLE_SUGGESTION":
        return apiError("所选建议暂时无法自动应用，请改为手动编辑。", 400);
      case "DIAGNOSIS_APPLY_BLOCKED":
        return apiError("诊断建议应用被真实性校验拦截。", 400, {
          warnings: error.details ?? [],
        });
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ResumeDiagnosisServiceError",
            code: error.code,
          },
        });
        return apiError("简历诊断失败，请稍后重试。", 500);
    }
  }

  if (error instanceof ExportServiceError) {
    switch (error.code) {
      case "RESUME_NOT_FOUND":
        return apiError("简历不存在或无权访问。", 404);
      case "VERSION_NOT_FOUND":
        return apiError("简历版本不存在或无权访问。", 404);
      case "EXPORT_NOT_FOUND":
        return apiError("导出记录不存在或无权访问。", 404);
      case "EXPORT_NOT_READY":
        return apiError("该导出记录尚未准备完成，请稍后重试。", 409);
      case "EXPORT_RETRY_NOT_ALLOWED":
        return apiError("只有失败的导出记录才能重试，成功记录请直接重新下载。", 409);
      case "EXPORT_UNSUPPORTED":
        return apiError("当前导出格式暂不支持下载。", 409);
      case "EXPORT_BROWSER_UNAVAILABLE":
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ExportServiceError",
            code: error.code,
          },
        });
        return apiError("当前环境缺少可用的浏览器内核，暂时无法生成 PDF。", 500);
      case "EXPORT_STORAGE_UNAVAILABLE":
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ExportServiceError",
            code: error.code,
          },
        });
        return apiError("PDF 导出存储配置不完整，请检查 R2 / S3 环境变量后重试。", 500);
      case "EXPORT_FILE_MISSING":
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ExportServiceError",
            code: error.code,
          },
        });
        return apiError("导出的文件未找到，请重新发起导出。", 410);
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "ExportServiceError",
            code: error.code,
          },
        });
        return apiError("导出处理失败，请稍后重试。", 500);
    }
  }

  if (error instanceof CommercialAccessServiceError) {
    switch (error.code) {
      case "MASTER_RESUME_LIMIT_REACHED":
        return apiError("免费试用的母版生成次数已用完，请升级 29 元套餐后继续使用。", 402, error.details);
      case "JD_TAILOR_LIMIT_REACHED":
        return apiError("JD 定制次数已用完，请升级或续费 29 元套餐后继续使用。", 402, error.details);
      case "DIAGNOSIS_LIMIT_REACHED":
        return apiError("简历诊断次数已用完，请升级或续费 29 元套餐后继续使用。", 402, error.details);
      case "PDF_EXPORT_LIMIT_REACHED":
        return apiError("PDF 导出次数已用完，请升级 29 元套餐后继续使用。", 402, error.details);
      case "USER_NOT_FOUND":
        return apiError("账号不存在，暂时无法处理套餐权益。", 404);
      default:
        captureServerException(error, {
          area: "resume-api",
          tags: {
            errorType: "CommercialAccessServiceError",
            code: error.code,
          },
        });
        return apiError("套餐权益处理失败，请稍后重试。", 500);
    }
  }

  captureServerException(error, {
    area: "resume-api",
  });

  return apiError("简历操作失败，请稍后重试。", 500);
}
