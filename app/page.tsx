import { LandingPage } from "@/components/landing/landing-page";
import { getLandingDemoGames } from "@/lib/landing/demo-games";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionAccess?: string }>;
}) {
  const { sessionAccess } = await searchParams;
  const notice = sessionAccess === "banned" || sessionAccess === "removed" ? sessionAccess : undefined;
  return <LandingPage games={await getLandingDemoGames()} notice={notice} />;
}
