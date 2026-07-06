"use client";

import { useEffect, useState } from "react";

import { getUserFriendlyErrorMessage } from "../../../lib/errors";
import { getAccountProfile } from "../api/getAccountProfile";
import { updateAccountProfile } from "../api/updateAccountProfile";
import type { AccountProfile, UpdateAccountProfileInput } from "../types";

export function useAccountProfile() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "danger" | "info"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice(null);
      try {
        const data = await getAccountProfile();
        if (!cancelled) {
          setProfile(data);
        }
      } catch (cause) {
        if (!cancelled) {
          setNotice({ tone: "danger", message: getUserFriendlyErrorMessage(cause) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = async (input: UpdateAccountProfileInput) => {
    setSaving(true);
    setNotice(null);
    try {
      const data = await updateAccountProfile(input);
      setProfile(data);
      setNotice({ tone: "info", message: "资料已保存并同步到身份核心。" });
      return true;
    } catch (cause) {
      setNotice({ tone: "danger", message: getUserFriendlyErrorMessage(cause) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    profile,
    loading,
    saving,
    notice,
    setNotice,
    updateProfile,
  };
}