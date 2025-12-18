"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

// Your VAPID public key - generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

type UsePushNotificationsReturn = {
  permission: PushPermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  checkSubscription: () => Promise<void>;
};

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if push is supported
  const isPushSupported = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!isPushSupported()) {
      setPermission("unsupported");
      setIsLoading(false);
      return;
    }

    try {
      // Check notification permission
      const notifPermission = Notification.permission;
      setPermission(notifPermission as PushPermissionState);

      if (notifPermission !== "granted") {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      // Check if we have an active subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Verify it exists in our database
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.id) {
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("endpoint", subscription.endpoint)
            .eq("user_id", session.session.user.id)
            .single();

          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error("Error checking push subscription:", err);
      setError("Failed to check notification status");
    } finally {
      setIsLoading(false);
    }
  }, [isPushSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) {
      setError("Push notifications not supported on this device");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications not configured");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const notifPermission = await Notification.requestPermission();
      setPermission(notifPermission as PushPermissionState);

      if (notifPermission !== "granted") {
        setError("Notification permission denied");
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Get the keys
      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys;

      if (!keys?.p256dh || !keys?.auth) {
        throw new Error("Failed to get subscription keys");
      }

      // Get current user
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        throw new Error("Not authenticated");
      }

      // Save to Supabase
      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: session.session.user.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
        }
      );

      if (dbError) {
        throw dbError;
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("Error subscribing to push:", err);
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
      setIsLoading(false);
      return false;
    }
  }, [isPushSupported, urlBase64ToUint8Array]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database first
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user?.id) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint)
            .eq("user_id", session.session.user.id);
        }

        // Unsubscribe from push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("Error unsubscribing from push:", err);
      setError("Failed to disable notifications");
      setIsLoading(false);
      return false;
    }
  }, []);

  // Check subscription status on mount
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}