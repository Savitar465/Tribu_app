"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchAppData } from "@/lib/db/api";
import type { AppData } from "@/lib/db/types";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Splash } from "@/components/Splash";
import { AppShell } from "@/components/phone/AppShell";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { ScreenRouter } from "@/components/screens/ScreenRouter";
import { AppProvider } from "@/lib/store";

/**
 * Auth gate + data loader. Watches the Supabase session; when signed in it
 * fetches the user's data and mounts the app, otherwise shows the auth screen.
 * Fetch results are tagged with their userId so switching accounts falls back
 * to the loading state without any synchronous resets.
 */
export function AppRoot() {
  const supabase = useMemo(() => createClient(), []);
  // undefined = session not yet known; null = signed out; string = user id.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<{ userId: string; data: AppData } | null>(null);
  const [error, setError] = useState<{ userId: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Track the session (fires immediately with the initial session).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load app data whenever we have a user (state is only set in async callbacks).
  useEffect(() => {
    if (typeof userId !== "string") return;
    let active = true;
    fetchAppData(supabase, userId)
      .then((data) => active && setResult({ userId, data }))
      .catch((e) => active && setError({ userId, message: e instanceof Error ? e.message : "Error" }));
    return () => {
      active = false;
    };
  }, [userId, supabase, reloadKey]);

  if (userId === undefined) return <Splash />;
  if (userId === null) return <AuthScreen />;

  if (error?.userId === userId && result?.userId !== userId) {
    const schemaMissing = /schema cache|could not find the table|does not exist|relation .* does not exist/i.test(
      error.message,
    );
    const message = schemaMissing
      ? "La base de datos aún no está configurada. Ejecuta las migraciones de supabase/migrations en el SQL Editor de tu proyecto Supabase y reintenta."
      : `No se pudieron cargar tus datos: ${error.message}`;
    return (
      <Splash
        message={message}
        onRetry={() => {
          setError(null);
          setResult(null);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  if (result?.userId !== userId) return <Splash />;

  return (
    <>
      <AppProvider key={userId} initialData={result.data}>
        <AppShell>
          <ScreenRouter />
        </AppShell>
      </AppProvider>
      <ServiceWorkerRegister />
      <InstallPrompt />
    </>
  );
}
