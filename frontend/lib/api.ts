// Thin client for the Prahari backend. One place owns the base URL and types.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8080";

export type IssueType =
  | "pothole"
  | "road_crack"
  | "debris"
  | "waterlogging"
  | "unknown";

export type Severity = "low" | "medium" | "high";

export type CaseStatus = "open" | "escalated" | "verified_resolved";

export interface CaseLocation {
  lat: number;
  lng: number;
  ward?: string | null;
}

export interface Verification {
  sameLocation: boolean;
  resolved: boolean;
  confidence: number;
  reasoning: string;
  verdict: "verified_resolved" | "needs_review";
  provenance: string;
  checkedAt: string;
  afterPhoto: string | null;
}

export interface Case {
  id: string;
  type: IssueType;
  severity: Severity;
  status: CaseStatus;
  location: CaseLocation;
  photos: { before: string[]; after: string[] };
  citizensAffected: number;
  description: string;
  createdAt: string;
  verifiedResolved: boolean;
  classificationConfidence?: number;
  resolvedAt?: string | null;
  resolutionReasoning?: string;
  resolutionConfidence?: number;
  lastVerification?: Verification;
  // Grounded routing (STEP 5)
  routedDept?: string | null;
  zone?: string | null;
  grievanceChannel?: string | null;
  routingMatched?: boolean;
  provenance?: string | null;
  // Voice reporting
  voiceLanguage?: string | null;
  voiceSpoken?: string | null;
  voiceTranscript?: string | null;
  // Community co-sign
  needsCommunity?: boolean;
  communityConfirmations?: number;
  communityConfirmed?: boolean;
  // Escalation (STEP 6)
  slaDeadline?: string | null;
  escalationLevel?: number;
  escalationLabel?: string;
  grievanceDraft?: string;
  escalations?: EscalationDraft[];
  lastEscalationReason?: string;
  rtiDraft?: RtiDraft;
}

export interface EscalationDraft {
  level: number;
  label: string;
  draftType: string;
  text: string;
  generatedAt: string;
  grounded: boolean;
}

export interface RtiDraft {
  label: string;
  draftType: string;
  text: string;
  generatedAt: string;
  grounded: boolean;
}

export const ESCALATION_LADDER = [
  "Filed",
  "Reminder sent",
  "Publicly escalated",
  "RTI drafted",
];

export interface ReportInput {
  lat: number;
  lng: number;
  note?: string;
  ward?: string;
  image?: File | null;
  audio?: File | null;
}

export interface TraceStep {
  agent: string;
  action: string;
  result: string;
  status: "done" | "flagged" | "unknown" | "alert";
}

export interface ReportResult {
  merged: boolean;
  case: Case;
  /** Present when merged: prior report count and updated affected total. */
  matchedCaseId?: string;
  matchesReports?: number;
  citizensAffected?: number;
  dedup?: { reasoning?: string; confidence?: number; provenance?: string };
  /** Present when a live merge crossed the threshold and auto-escalated. */
  autoEscalation?: EscalationDraft | null;
  /** The visible agent trace: which agent ran and what it decided. */
  trace?: TraceStep[];
  verification?: { confident: boolean; needsCommunity: boolean; note: string };
  voice?: { language: string; spokenText: string; englishText: string };
}

/** Submit a new report. The backend either creates a case or merges it. */
export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const form = new FormData();
  form.append("lat", String(input.lat));
  form.append("lng", String(input.lng));
  if (input.note) form.append("note", input.note);
  if (input.ward) form.append("ward", input.ward);
  if (input.image) form.append("image", input.image);
  if (input.audio) form.append("audio", input.audio);

  const res = await fetch(`${API_BASE}/report`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Report failed (${res.status})`);
  }
  return res.json();
}

export interface VerifyResponse {
  verification: Verification;
  case: Case;
}

/** Submit a follow-up photo to verify a resolution with Gemini Vision.
 * Optionally include a before photo when the case has none on file. */
export async function verifyResolution(
  caseId: string,
  image: File,
  before?: File | null
): Promise<VerifyResponse> {
  const form = new FormData();
  form.append("image", image);
  if (before) form.append("before", before);
  const res = await fetch(`${API_BASE}/cases/${caseId}/verify`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Verification failed (${res.status})`);
  }
  return res.json();
}

export interface EscalationResponse {
  advanced: boolean;
  reason?: string;
  escalation?: EscalationDraft;
  case: Case;
}

/** Manually advance the escalation ladder one level (demo control). */
export async function advanceEscalation(caseId: string): Promise<EscalationResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/advance-escalation`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not advance escalation (${res.status})`);
  }
  return res.json();
}

/** Run the time-based SLA check; advances a level only if past the deadline. */
export async function checkEscalation(caseId: string): Promise<EscalationResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/check-escalation`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not check escalation (${res.status})`);
  }
  return res.json();
}

export interface WardScore {
  ward: string;
  rank: number;
  responsivenessScore: number;
  verifiedResolvedCount: number;
  avgResolutionDays: number | null;
  openCount: number;
  oldestOpenAgeDays: number;
}

export interface DeptScore extends Omit<WardScore, "ward"> {
  department: string;
}

export interface Scoreboard {
  wards: WardScore[];
  departments: DeptScore[];
  headline: {
    totalCases: number;
    totalCitizensAffected: number;
    verifiedResolvedCount: number;
    avgResolutionDays: number | null;
  };
  source: string;
}

export interface WardInsight {
  ward: string;
  openCount: number;
  avgUnresolvedAgeDays: number;
  riskLevel: "low" | "medium" | "high";
  riskNote: string;
}

/** Fetch the government responsiveness scoreboard. */
export async function fetchScoreboard(): Promise<Scoreboard | null> {
  try {
    const res = await fetch(`${API_BASE}/scoreboard`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Fetch per-ward predictive risk insights. */
export async function fetchInsights(): Promise<WardInsight[]> {
  try {
    const res = await fetch(`${API_BASE}/insights`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.wards ?? []) as WardInsight[];
  } catch {
    return [];
  }
}

export interface CosignResponse {
  case: Case;
  autoEscalation?: EscalationDraft | null;
}

/** Community co-sign: confirm you see this issue too. */
export async function cosignCase(caseId: string): Promise<CosignResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/cosign`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not co-sign (${res.status})`);
  }
  return res.json();
}

/** Remove a single case. */
export async function deleteCase(caseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not remove case (${res.status})`);
  }
}

/** Clear every case from the board. */
export async function clearAllCases(): Promise<number> {
  const res = await fetch(`${API_BASE}/cases`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not clear cases (${res.status})`);
  }
  const data = await res.json();
  return data.deleted ?? 0;
}

/** Generate a citizen-fileable RTI request for a case (top rung only). */
export async function generateRtiDraft(caseId: string): Promise<RtiDraft> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/rti-draft`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not generate the RTI draft (${res.status})`);
  }
  const data = await res.json();
  return data.rti as RtiDraft;
}

/** Fetch all cases for the map and list. */
export async function fetchCases(): Promise<Case[]> {
  const res = await fetch(`${API_BASE}/cases`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Could not load cases (${res.status})`);
  }
  const data = await res.json();
  return (data.cases ?? []) as Case[];
}

async function safeDetail(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    return data.detail ?? null;
  } catch {
    return null;
  }
}

// Display helpers shared across the UI.
export const ISSUE_LABEL: Record<IssueType, string> = {
  pothole: "Pothole",
  road_crack: "Road crack",
  debris: "Debris",
  waterlogging: "Waterlogging",
  unknown: "Unclassified",
};

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
