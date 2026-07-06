"use client";

import { useEffect, useState } from "react";

import { getUserFriendlyErrorMessage } from "../../../lib/errors";

export function useCenterResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await loader();
        if (!cancelled) setData(result);
      } catch (cause) {
        if (!cancelled) setError(getUserFriendlyErrorMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, ...deps]);

  const reload = () => {
    setReloadToken((value) => value + 1);
  };

  return { data, error, loading, reload };
}