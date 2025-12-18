"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

// Your VAPID public key - generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Debug log on load
console.log("[Push] VAPID key loaded:", VAPID_PUBLIC_KEY ? `${VAPID_PUBLIC_KEY.slice(0, 20)}...` : "MISSING!");

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
    const supported = 
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    
    console.log("[Push] Support check:", {
      window: typeof window !== "undefined",
      serviceWorker: "serviceWorker" in navigator,
      PushManager: "PushManager" in window,
      Notification: "Notification" in window,
      supported
    });
    
    return supported;
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
    console.log("[Push] Checking subscription status...");
    
    if (!isPushSupported()) {
      console.log("[Push] Not supported on this device");
      setPermission("unsupported");
      setIsLoading(false);
      return;
    }

    try {
      // Check notification permission
      const notifPermission = Notification.permission;
      console.log("[Push] Current permission:", notifPermission);
      setPermission(notifPermission as PushPermissionState);

      if (notifPermission !== "granted") {
        console.log("[Push] Permission not granted, skipping subscription check");
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      // Check if we have an active subscription
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready:", registration);
      
      const subscription = await registration.pushManager.getSubscription();
      console.log("[Push] Existing subscription:", subscription ? "Found" : "None");

      if (subscription) {
        // Verify it exists in our database
        const { data: session } = await supabase.auth.getSession();
        console.log("[Push] User session:", session?.session?.user?.id ? "Authenticated" : "Not authenticated");
        
        if (session?.session?.user?.id) {
          const { data, error: dbError } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("endpoint", subscription.endpoint)
            .eq("user_id", session.session.user.id)
            .single();

          console.log("[Push] DB subscription check:", { found: !!data, error: dbError?.message });
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error("[Push] Error checking subscription:", err);
      setError("Failed to check notification status");
    } finally {
      setIsLoading(false);
    }
  }, [isPushSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    console.log("[Push] Subscribe called");
    
    if (!isPushSupported()) {
      const msg = "Push notifications not supported on this device";
      console.error("[Push]", msg);
      setError(msg);
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      const msg = "Push notifications not configured - VAPID key missing";
      console.error("[Push]", msg);
      setError(msg);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      console.log("[Push] Requesting permission...");
      const notifPermission = await Notification.requestPermission();
      console.log("[Push] Permission result:", notifPermission);
      setPermission(notifPermission as PushPermissionState);

      if (notifPermission !== "granted") {
        setError("Notification permission denied");
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      console.log("[Push] Getting service worker...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready");

      // Subscribe to push
      console.log("[Push] Creating push subscription...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] Subscription created:", subscription.endpoint.slice(0, 50) + "...");

      // Get the keys
      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys;

      if (!keys?.p256dh || !keys?.auth) {
        throw new Error("Failed to get subscription keys");
      }
      console.log("[Push] Got subscription keys");

      // Get current user
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        throw new Error("Not authenticated");
      }
      console.log("[Push] User authenticated:", session.session.user.id);

      // Save to Supabase
      console.log("[Push] Saving to database...");
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
        console.error("[Push] DB error:", dbError);
        throw dbError;
      }

      console.log("[Push] Successfully subscribed!");
      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[Push] Error subscribing:", err);
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
      setIsLoading(false);
      return false;
    }
  }, [isPushSupported, urlBase64ToUint8Array]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    console.log("[Push] Unsubscribe called");
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
        console.log("[Push] Unsubscribed successfully");
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[Push] Error unsubscribing:", err);
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