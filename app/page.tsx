import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { ContentStudio } from "./ContentStudio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <ContentStudio
      initialUser={user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
