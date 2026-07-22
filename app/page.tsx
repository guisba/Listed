import { LandingPage } from "@/components/landing/landing-page";
import { getLandingDemoGames } from "@/lib/landing/demo-games";

export default async function HomePage() {
  return <LandingPage games={await getLandingDemoGames()} />;
}
