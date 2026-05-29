import { cn } from "@/lib/utils";

interface PageSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({ title, description, children, className }: PageSectionProps) {
  return (
    <section className={cn("ops-section space-y-4", className)}>
      <div>
        <h2 className="ops-page-title">{title}</h2>
        {description && <p className="ops-page-subtitle mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}
