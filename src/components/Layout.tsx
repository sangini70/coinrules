import * as React from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-main-bg text-text-main font-sans selection:bg-blue-500 selection:text-white">
      {children}
    </div>
  );
}
