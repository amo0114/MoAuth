import { fetchJson } from "../../../lib/api/client";
import { activityListResponseSchema } from "../schemas";
import type { ActivityEvent } from "../types";

export async function getActivityList(): Promise<ActivityEvent[]> {
  const data = await fetchJson("/api/activity", activityListResponseSchema);
  return data.events;
}