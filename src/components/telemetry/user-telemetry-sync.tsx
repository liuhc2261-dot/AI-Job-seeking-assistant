"use client";

import { useEffect } from "react";

import { identifyAnalyticsUser } from "@/lib/telemetry/client";

type UserTelemetrySyncProps = {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    status?: string | null;
  };
};

export function UserTelemetrySync({ user }: UserTelemetrySyncProps) {
  useEffect(() => {
    if (!user.id) {
      return;
    }

    identifyAnalyticsUser(user);
  }, [user]);

  return null;
}
