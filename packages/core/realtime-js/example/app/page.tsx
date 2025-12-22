import { Chat } from "@/components/chat";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <Chat />
    </main>
  );
}
