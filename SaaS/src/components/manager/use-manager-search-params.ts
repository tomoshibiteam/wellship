'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  parseRange,
  parseScope,
  scopeToVesselId,
} from '@/lib/manager/search-params';
import type { ManagerRange, ManagerScope } from '@/lib/manager/types';

export function useManagerSearchParams() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const scope = useMemo(
    () => parseScope(searchParams.get('scope')),
    [searchParams]
  );
  const range = useMemo(
    () => parseRange(searchParams.get('range')),
    [searchParams]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!params.get('scope')) {
      let derivedScope = scope;
      if (pathname.startsWith('/manager/vessels/')) {
        const vesselId = pathname.split('/manager/vessels/')[1]?.split('/')[0];
        if (vesselId) {
          derivedScope = `vessel:${vesselId}`;
        }
      } else {
        const vesselParam = params.get('vesselId');
        if (vesselParam) {
          derivedScope = `vessel:${vesselParam}`;
        }
      }
      params.set('scope', derivedScope);
      changed = true;
    }
    if (!params.get('range')) {
      params.set('range', range);
      changed = true;
    }

    if (pathname.startsWith('/manager/crew')) {
      const vesselId = params.get('vesselId');
      const derived = scopeToVesselId(scope);
      if (!vesselId && derived) {
        params.set('vesselId', derived);
        changed = true;
      }
    }

    if (changed) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [pathname, range, router, scope, searchParams]);

  const updateParams = (updates: { scope?: ManagerScope; range?: ManagerRange }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.scope) {
      params.set('scope', updates.scope);
      if (pathname.startsWith('/manager/crew')) {
        const vesselId = scopeToVesselId(updates.scope);
        if (vesselId) {
          params.set('vesselId', vesselId);
        } else {
          params.delete('vesselId');
        }
      }
    }
    if (updates.range) {
      params.set('range', updates.range);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return {
    scope,
    range,
    setScope: (next: ManagerScope) => updateParams({ scope: next }),
    setRange: (next: ManagerRange) => updateParams({ range: next }),
  };
}
