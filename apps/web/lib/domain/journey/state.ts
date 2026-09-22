export const journeyStages = ["requirement_understanding", "qualification", "follow_up", "booking_ready", "booking_in_progress", "converted", "disqualified", "dormant"] as const;
export type JourneyStage = typeof journeyStages[number];
export function stageForLead(status: string): JourneyStage { if (status === "qualified" || status === "booking_ready") return "booking_ready"; if (status === "booking_in_progress") return "booking_in_progress"; if (status === "converted") return "converted"; if (status === "disqualified") return "disqualified"; if (status === "dormant") return "dormant"; return status === "qualifying" ? "qualification" : "requirement_understanding"; }
export function bookingReady(qualificationStatus: string) { return qualificationStatus === "qualified"; }
export function retryDelaySeconds(attemptCount: number) { return Math.min(3600, 60 * 2 ** Math.max(0, attemptCount - 1)); }
