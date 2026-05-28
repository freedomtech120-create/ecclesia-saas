import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Cloud Function to monitor the 'users' collection.
 * It detects if user's smsBalance falls below their configured threshold.
 * If below threshold, it writes a custom in-app notification to the notifications collection.
 * It prevents notification spam by tracking 'notifiedLowBalance' flag state on the user's document.
 */
export const onUserSmsBalanceTrigger = onDocumentUpdated("users/{userId}", async (event) => {
  const newValue = event.data?.after.data();
  const previousValue = event.data?.before.data();

  if (!newValue) return;

  const currentBalance = typeof newValue.smsBalance === "number" ? newValue.smsBalance : 50;
  const threshold = typeof newValue.smsBalanceThreshold === "number" ? newValue.smsBalanceThreshold : 50;
  const notifiedLowBalance = newValue.notifiedLowBalance === true;
  const userId = event.params.userId;

  // Check if balance fell below threshold and we haven't notified the user yet
  if (currentBalance < threshold && !notifiedLowBalance) {
    const db = admin.firestore();
    const tenantId = newValue.tenantId || "unknown";

    // Create system notification
    await db.collection("notifications").add({
      tenantId,
      userId,
      title: "⚠️ Low SMS Credit Warning",
      message: `Your SMS credits balance has fallen below your configured threshold of ${threshold} units. Current balance is ${currentBalance} units. Please purchase a credit top-up pack.`,
      type: "sms_balance_alert",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark user as notified to avoid email/alert spam on subsequent updates
    await event.data?.after.ref.update({
      notifiedLowBalance: true
    });
    
    console.log(`[SMS Balance Monitor] Triggered low-sms credit notification for User: ${userId}. Balance: ${currentBalance}, Threshold: ${threshold}`);
  } else if (currentBalance >= threshold && notifiedLowBalance) {
    // Reset notification flag if user topped up their balance above the threshold
    await event.data?.after.ref.update({
      notifiedLowBalance: false
    });
    console.log(`[SMS Balance Monitor] Reset notified status for User: ${userId} since balance is topped up to ${currentBalance}`);
  }
});
