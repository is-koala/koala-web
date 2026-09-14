import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { ProfilePageView, type ProfileDataResult } from "@/components/profile-page";
import type { Availability } from "@/lib/availability";
import type { AcademicReference, NotificationPreference } from "@/lib/profile";
import { failureView } from "@/server/form";
import { getAvailability } from "@/server/profile/availability";
import { getNotificationPreferences, getUniversities } from "@/server/profile/profile";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Profilim",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const [preferences, universities, availability] = await Promise.all([
    loadData<readonly NotificationPreference[]>(getNotificationPreferences()),
    loadData<readonly AcademicReference[]>(getUniversities()),
    loadData<Availability>(getAvailability(viewer.id)),
  ]);

  return (
    <ProfilePageView
      profile={viewer}
      preferences={preferences}
      universities={universities}
      availability={availability}
    />
  );
}

async function loadData<T>(request: Promise<T>): Promise<ProfileDataResult<T>> {
  try {
    return { status: "ready", data: await request };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}
