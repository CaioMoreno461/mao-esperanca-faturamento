import { redirect } from "next/navigation";
import FinanceApp from "./components/FinanceApp";
import { getAuthUser } from "./auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthUser();
  if (!user) redirect("/entrar");
  return <FinanceApp />;
}
