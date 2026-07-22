import type { Metadata } from "next";
import { RoomClient } from "@/components/sessions/room-client";
import { getServerI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { t } = await getServerI18n();
  return { title: t("session.meta", { code }), robots: { index: false, follow: false } };
}

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}
