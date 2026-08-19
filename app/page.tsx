import { redirect } from "next/navigation";
import FinanceApp from "./components/FinanceApp";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) redirect("/entrar");
  return <FinanceApp />;
}
