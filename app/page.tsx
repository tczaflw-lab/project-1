import { chatGPTSignInPath } from "./chatgpt-auth";
import { getCurrentUser } from "./auth";
import { ContentStudio } from "./ContentStudio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <ContentStudio
      initialUser={user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
