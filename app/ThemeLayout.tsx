'use client';
import React from 'react';

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
  }, []);

  return <>{children}</>;
} 