import { AvatarStudio } from "@/components/avatar/AvatarStudio";

export const metadata = { title: "AI Avatars" };

export default function AvatarPage() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">AI Avatars</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Govinda & Durga — voice, conversational avatars, and healthcare personas
        </p>
      </div>
      <AvatarStudio />
    </div>
  );
}