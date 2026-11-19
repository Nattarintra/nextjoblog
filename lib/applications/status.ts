import type { ApplicationStatus } from "@/lib/applications/types";

export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger";

export const INITIAL_APPLICATION_STATUS: ApplicationStatus = "applied";

export const STATUS_DISPLAY: Record<ApplicationStatus, { label: string; tone: StatusTone }> = {
  interested: { label: "Interested", tone: "neutral" },
  preparing: { label: "Preparing application", tone: "neutral" },
  applied: { label: "Applied", tone: "info" },
  recruiter_contacted: { label: "Recruiter Responded", tone: "info" },
  interview_scheduled: { label: "Interview Scheduled", tone: "info" },
  technical_test: { label: "Technical Test", tone: "progress" },
  reference_check: { label: "Reference Check", tone: "progress" },
  offer_received: { label: "Offer Received", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};
