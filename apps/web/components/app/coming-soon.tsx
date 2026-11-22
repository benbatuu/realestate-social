import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Placeholder for a menu whose feature is planned. Says what it will do and when. */
export function ComingSoon({
  title,
  description,
  points,
  icon: Icon,
}: {
  title: string;
  description: string;
  points: string[];
  icon: LucideIcon;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" aria-hidden />
            Yakında
          </CardTitle>
          <CardDescription>Bu ekran hazırlanıyor. Gelecekler:</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
