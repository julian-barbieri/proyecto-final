import Navbar from "./Navbar";

export default function PageLayout({ children, title, subtitle, actions }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {title && (
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
