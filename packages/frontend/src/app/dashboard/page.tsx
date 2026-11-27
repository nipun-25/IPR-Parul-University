'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StudentDashboardPage from '../student/dashboard/page';

/**
 * Legacy /dashboard route.
 * Redirects automatically to the canonical /student/dashboard route while
 * preserving backwards-compatibility and test execution.
 */
export default function LegacyDashboardRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/student/dashboard');
  }, [router]);

  return <StudentDashboardPage />;
}
