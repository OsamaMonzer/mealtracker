'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }) {
  const [authed, setAuthed] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') { setAuthed(true); return; }
    const ok = localStorage.getItem('mt_auth') === 'yes';
    if (!ok) {
      router.replace('/login');
    } else {
      setAuthed(true);
    }
  }, [pathname]);

  if (authed === null) return null; // brief blank while checking
  return children;
}
