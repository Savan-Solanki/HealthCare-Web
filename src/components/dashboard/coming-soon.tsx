import { Clock } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Clock size={24} className="text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {description ?? 'This section is under development and will be available soon.'}
        </p>
      </div>
      <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
        Coming Soon
      </span>
    </div>
  );
}
