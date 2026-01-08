type PageHeaderProps = {
  title: string;
  description: string;
  badge?: string;
};

export function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white/90 px-5 py-4 shadow-[0_12px_32px_rgba(14,94,156,0.06)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {badge ? (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
