import type { ResumeVersionKind } from "@/types/resume";

export type ResumeExportType = "markdown" | "pdf" | "text";

export type ResumeExportStatus = "pending" | "success" | "failed";

export type ExportTemplate = {
  id: string;
  name: string;
  description: string;
  recommendedFor: string;
};

export type ExportFormatOption = {
  id: ResumeExportType;
  label: string;
  description: string;
  available: boolean;
};

export type ResumeExportRecord = {
  id: string;
  resumeId: string;
  resumeVersionId: string;
  resumeVersionName: string;
  resumeVersionType: ResumeVersionKind;
  jobTargetTitle: string | null;
  jobTargetCompany: string | null;
  exportType: ResumeExportType;
  templateName: string;
  status: ResumeExportStatus;
  fileUrl: string | null;
  fileSize: number | null;
  createdAt: string;
};
