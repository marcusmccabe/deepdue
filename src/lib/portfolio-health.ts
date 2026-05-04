import type { AccountsAnalysis } from "./analysis-types";

export type PortfolioFlag =
  | "going_concern"
  | "director_flags"
  | "gazette_notice"
  | "declining_margin";

export interface PortfolioComputed {
  healthScore: number;
  flags: PortfolioFlag[];
  hasGoingConcern: boolean;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function computePortfolio(
  analysis: AccountsAnalysis | null | undefined
): PortfolioComputed {
  if (!analysis) {
    return { healthScore: 0, flags: [], hasGoingConcern: false };
  }

  let score = 100;
  const flags: PortfolioFlag[] = [];

  const goingConcernFlag =
    analysis.auditorAndGoingConcern?.goingConcernFlag === true ||
    /going\s*concern/i.test(asString(analysis.auditorAndGoingConcern?.goingConcernDetail)) ||
    /going\s*concern/i.test(asString(analysis.risksAndWarnings?.goingConcern)) ||
    /material\s+uncertainty/i.test(asString(analysis.auditorAndGoingConcern?.emphasisOfMatter));

  if (goingConcernFlag) {
    flags.push("going_concern");
    score -= 45;
  }

  const auditOpinion = (
    asString(analysis.auditorAndGoingConcern?.auditOpinion) ||
    asString(analysis.auditOpinion?.opinion)
  ).toLowerCase();
  if (auditOpinion.includes("qualified")) score -= 15;
  if (auditOpinion.includes("adverse") || auditOpinion.includes("disclaimer")) score -= 30;

  const redFlags = Array.isArray(analysis.redFlags) ? analysis.redFlags.length : 0;
  score -= Math.min(30, redFlags * 5);

  const credit = asString(analysis.creditAssessment?.overallRating).toLowerCase();
  if (credit.includes("high")) score -= 20;
  else if (credit.includes("medium")) score -= 8;

  const directorBlob = [
    asString(analysis.directorFlags?.directorLoans),
    asString(analysis.directorFlags?.relatedPartyTransactions),
    asString(analysis.relatedPartyTransactions?.summary),
  ].join(" ").toLowerCase();
  if (
    directorBlob &&
    !/(none|no\s|not\s+disclosed|n\/a)/i.test(directorBlob) &&
    /(loan|advance|director|related\s*party)/.test(directorBlob)
  ) {
    flags.push("director_flags");
    score -= 5;
  }

  const complianceBlob = [
    asString(analysis.complianceSignals?.dormancyOrStrikeOff),
    asString(analysis.filingBehaviour?.filingPattern),
  ].join(" ").toLowerCase();
  if (/(gazette|strike\s*off|first\s*gazette|dissolution)/.test(complianceBlob)) {
    flags.push("gazette_notice");
    score -= 25;
  }

  const marginBlob = [
    asString(analysis.financialPerformance?.marginAnalysis),
    asString(analysis.financialPerformance?.yearOnYearTrend),
    asString(analysis.margins?.trend),
  ].join(" ").toLowerCase();
  if (/(declin|deteriorat|compress|fall|contract|narrow)/.test(marginBlob)) {
    flags.push("declining_margin");
    score -= 8;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { healthScore: score, flags, hasGoingConcern: goingConcernFlag };
}

export function healthPillColours(score: number): { bg: string; color: string } {
  if (score < 40) return { bg: "#FCEBEB", color: "#A32D2D" };
  if (score <= 70) return { bg: "#FAEEDA", color: "#854F0B" };
  return { bg: "#EAF3DE", color: "#3B6D11" };
}

export const FLAG_LABELS: Record<PortfolioFlag, string> = {
  going_concern: "Going concern",
  director_flags: "Director flags",
  gazette_notice: "Gazette notice",
  declining_margin: "Declining margin",
};
