import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Initialize Firebase Admin ---
  let adminDb: admin.firestore.Firestore | null = null;
  try {
    const configRaw = fs.readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf8");
    const firebaseConfig = JSON.parse(configRaw);
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    adminDb = admin.firestore(firebaseConfig.firestoreDatabaseId);
    console.log(`[Firebase Admin] Successfully initialized Firestore database ID: ${firebaseConfig.firestoreDatabaseId}`);

    // Seed default SMS Packages if empty
    seedDefaultSMSPackages(adminDb);

    // Initialize the live background SMS balance threshold monitor
    startSmsBalanceMonitoring(adminDb);
  } catch (err: any) {
    console.error("[Firebase Admin] Initialization failed:", err.message);
  }

  // Live background monitor tracking user balance thresholds
  function startSmsBalanceMonitoring(db: admin.firestore.Firestore) {
    console.log("[SMS Monitor] Starting live Firestore listener for 'users' threshold alerts...");
    db.collection("users").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          try {
            const userData = change.doc.data();
            const userId = change.doc.id;
            
            const currentBalance = typeof userData.smsBalance === "number" ? userData.smsBalance : 50;
            const threshold = typeof userData.smsBalanceThreshold === "number" ? userData.smsBalanceThreshold : 50;
            const notified = userData.notifiedLowBalance === true;

            if (currentBalance < threshold && !notified) {
              console.log(`[SMS Monitor] User ${userId} balance (${currentBalance}) fell below threshold (${threshold}). Creating notification...`);
              
              // 1. Create in-app system notification
              await db.collection("notifications").add({
                tenantId: userData.tenantId || "unknown",
                userId: userId,
                title: "⚠️ Low SMS Credit Warning",
                message: `Your SMS credits balance has fallen below your configured threshold of ${threshold} units. Current balance is ${currentBalance} units. Please purchase a credit top-up pack.`,
                type: "sms_balance_alert",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });

              // 2. Lock notification state flag
              await db.collection("users").doc(userId).update({
                notifiedLowBalance: true
              });
            } else if (currentBalance >= threshold && notified) {
              console.log(`[SMS Monitor] User ${userId} balance (${currentBalance}) restored above threshold (${threshold}). Resetting notifier lock...`);
              await db.collection("users").doc(userId).update({
                notifiedLowBalance: false
              });
            }
          } catch (err: any) {
            console.error("[SMS Monitor] Error applying trigger update:", err.message);
          }
        }
      });
    }, (error) => {
      console.error("[SMS Monitor] Live user stream got error:", error);
    });
  }

  async function seedDefaultSMSPackages(db: admin.firestore.Firestore) {
    try {
      const q = await db.collection("sms_packages").get();
      if (q.empty) {
        console.log("[SMS Packages] Seeding starter, business, and premium reseller packages...");
        const defaults = [
          { name: "Starter Tier", smsCount: 100, price: 10, active: true },
          { name: "Business Growth", smsCount: 500, price: 45, active: true },
          { name: "Premium Enterprise", smsCount: 1000, price: 80, active: true }
        ];
        for (const pkg of defaults) {
          await db.collection("sms_packages").add({
            ...pkg,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    } catch (e: any) {
      console.warn("[SMS Packages] Seeding skipped/failed:", e.message);
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), firebaseAdmin: !!adminDb });
  });

  // SMS Gateway Provider Implementation
  class SMSProvider {
    config: any;
    constructor(config: any) {
      this.config = config;
    }

    async sendSMS(recipients: string[], message: string): Promise<{ success: boolean; rawResponse: any }> {
      const provider = this.config.provider;
      const apiKey = this.config.apiKey || "";
      const apiSecret = this.config.apiSecret || "";
      const senderId = this.config.senderId || "Ecclesia";

      const formatPhoneNumber = (num: string, p: string) => {
        let cleaned = num.replace(/[\s\-\(\)\+]/g, ""); // strip characters
        if (p === "mnotify" || p === "arkasel" || p === "arkesel" || p === "hubtel") {
          if (cleaned.startsWith("0") && cleaned.length === 10) {
            return "233" + cleaned.substring(1);
          }
          if (cleaned.startsWith("233") && cleaned.length === 12) {
            return cleaned;
          }
        }
        if (p === "twilio" || p === "africastalking") {
          let hasPlus = num.startsWith("+");
          let numbersOnly = num.replace(/[\s\-\(\)]/g, "");
          if (!hasPlus && !numbersOnly.startsWith("+")) {
            return "+" + numbersOnly;
          }
          return numbersOnly;
        }
        return cleaned;
      };

      const cleanedRecipients = recipients.map(r => formatPhoneNumber(r, provider));

      if (provider === "arkasel" || provider === "arkesel") {
        const v2Endpoints = [
          "https://sms.arkesel.com/api/v2/sms/send",
          "https://open.arkesel.com/api/v1/sms/send",
          "https://api.arkesel.com/v2/sms/send"
        ];

        let lastError: any = null;
        for (const endpoint of v2Endpoints) {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "api-key": apiKey,
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              body: JSON.stringify({
                sender: senderId,
                message: message,
                recipients: cleanedRecipients,
                sandbox: false
              })
            });

            const rawText = await response.text();
            let resData: any = {};
            try { resData = JSON.parse(rawText); } catch (e) {}

            const codeStr = resData?.code || resData?.status || "";
            if (response.ok && (
              codeStr.toString() === "1000" ||
              codeStr.toString() === "101" ||
              codeStr.toString() === "200" ||
              codeStr.toLowerCase().includes("success") ||
              resData?.message?.toLowerCase().includes("success")
            )) {
              return { success: true, rawResponse: resData };
            } else {
              lastError = resData;
            }
          } catch (v2Err) {
            console.warn(`[Arkesel Provider] Endpoint ${endpoint} failed:`, v2Err);
            lastError = v2Err;
          }
        }

        // Try Legacy v1 format
        const recipientsStr = cleanedRecipients.join(",");
        const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(recipientsStr)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(message)}`;
        try {
          const responseV1 = await fetch(v1Url);
          const textV1 = await responseV1.text();
          if (responseV1.ok && (textV1.includes("1000") || textV1.toLowerCase().includes("success"))) {
            return { success: true, rawResponse: { mode: "v1", response: textV1 } };
          }
          throw new Error(`v1 transmission failed: ${textV1}`);
        } catch (e: any) {
          throw new Error(`Arkesel transmission failed. Last reply: ${lastError?.message || JSON.stringify(lastError)} | v1 reply: ${e.message}`);
        }
      }

      else if (provider === "hubtel") {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(`${apiSecret}:${apiKey}`).toString("base64")}`
        };
        const response = await fetch("https://smsc.hubtel.com/v1/messages/send", {
          method: "POST",
          headers,
          body: JSON.stringify({
            from: senderId,
            to: cleanedRecipients[0], // simple Hubtel dispatch
            content: message,
            registeredDelivery: true
          })
        });

        const resText = await response.text();
        let resData: any = {};
        try { resData = JSON.parse(resText); } catch (e) {}

        if (response.ok && (resData.status === "0" || resData.status === 0 || resData.responseCode === "0000" || resData.message?.toLowerCase().includes("success"))) {
          return { success: true, rawResponse: resData };
        } else {
          throw new Error(`Hubtel API error: ${resText}`);
        }
      }

      else if (provider === "twilio") {
        const promises = cleanedRecipients.map(async (to) => {
          const params = new URLSearchParams();
          params.append("To", to);
          params.append("From", senderId);
          params.append("Body", message);
          
          const auth = Buffer.from(`${apiSecret}:${apiKey}`).toString("base64");
          const resTwilio = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${apiSecret}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: params
            }
          );
          if (!resTwilio.ok) {
            const body = await resTwilio.text();
            throw new Error(body);
          }
          return resTwilio;
        });

        await Promise.all(promises);
        return { success: true, rawResponse: { provider: "twilio", count: cleanedRecipients.length } };
      }

      else if (provider === "africastalking") {
        const params = new URLSearchParams();
        params.append("username", apiSecret);
        params.append("to", cleanedRecipients.join(","));
        params.append("message", message);
        if (senderId) {
          params.append("from", senderId);
        }

        const response = await fetch("https://api.africastalking.com/version1/messaging", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "apiKey": apiKey
          },
          body: params
        });

        const resData = await response.json() as any;
        if (response.ok && resData.SMSMessageData) {
          return { success: true, rawResponse: resData.SMSMessageData };
        } else {
          throw new Error(JSON.stringify(resData));
        }
      }

      throw new Error(`Unsupported or unconfigured gateway: ${provider}`);
    }
  }

  // --- Central Admin API Gateway Settings Info ---
  app.get("/api/sms/gateway-status", async (req, res) => {
    if (!adminDb) return res.status(500).json({ error: "Firebase uninitialized" });

    try {
      const activeGatewayDoc = await adminDb.collection("gateway_settings").doc("active").get();
      if (!activeGatewayDoc.exists) {
        return res.json({ configured: false, provider: null, isActive: false });
      }

      const activeGateway = activeGatewayDoc.data() || {};
      return res.json({
        configured: true,
        provider: activeGateway.provider,
        isActive: activeGateway.isActive,
        senderId: activeGateway.senderId,
        balance: activeGateway.balance || "Unlimited"
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Send SMS Reseller Dispatch Endpoint ---
  app.post("/api/sms/send", async (req, res) => {
    if (!adminDb) return res.status(500).json({ error: "Firebase DB uninitialized" });

    try {
      const { userId, recipients, message, isSuperAdminBypass } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients must be a non-empty list of string" });
      }
      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Message content must not be blank" });
      }

      // 1. Fetch active admin gateway settings
      const activeGatewayDoc = await adminDb.collection("gateway_settings").doc("active").get();
      if (!activeGatewayDoc.exists || !activeGatewayDoc.data()?.isActive) {
        return res.status(400).json({ error: "The central SMS gateway is currently offline or unconfigured. Please notify the administrator." });
      }
      const activeGateway = activeGatewayDoc.data()!;

      // 2. Fetch user information
      const userDocRef = adminDb.collection("users").doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User profile record not found" });
      }
      const userData = userDoc.data()!;
      
      // Calculate SMS credits required (each page length limit 160 characters)
      const pages = Math.ceil(message.length / 160) || 1;
      const requiredCredits = recipients.length * pages;

      const currentSmsBalance = typeof userData.smsBalance === "number" ? userData.smsBalance : 50; // default starter 50 bonus

      // 3. Balance Validation (Skip for Super-Admin bypass)
      if (!isSuperAdminBypass && currentSmsBalance < requiredCredits) {
        return res.status(400).json({
          error: `Insufficient SMS credits. Required: ${requiredCredits}, Available: ${currentSmsBalance}. Please buy a package of credits to continue.`
        });
      }

      // 4. Initialize Core Provider Client & dispatch
      const providerClient = new SMSProvider(activeGateway);
      let gatewayReply: any = null;
      let sendSuccess = false;

      try {
        const sendResult = await providerClient.sendSMS(recipients, message);
        gatewayReply = sendResult.rawResponse;
        sendSuccess = sendResult.success;
      } catch (sendError: any) {
        console.error("[SMS Gateway Dispatch Failed]:", sendError.message);
        gatewayReply = { error: sendError.message };
        sendSuccess = false;
      }

      if (!sendSuccess) {
        // Record failed transaction for analytics without subtracting balance
        await adminDb.collection("sms_transactions").add({
          userId,
          tenantId: userData.tenantId || "unknown",
          recipients,
          message,
          smsCount: requiredCredits,
          status: "failed",
          senderId: activeGateway.senderId || "Ecclesia",
          gateway_response: gatewayReply,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(500).json({
          error: `Transmission failed via central gateway broker: ${gatewayReply?.error || "Unknown vendor error"}`
        });
      }

      // 5. Deduct balance in transaction
      if (!isSuperAdminBypass) {
        await userDocRef.update({
          smsBalance: admin.firestore.FieldValue.increment(-requiredCredits)
        });
      }

      // 6. Log transaction details
      const transactionRef = await adminDb.collection("sms_transactions").add({
        userId,
        tenantId: userData.tenantId || "unknown",
        recipients,
        message,
        smsCount: requiredCredits,
        status: "delivered",
        senderId: activeGateway.senderId || "Ecclesia",
        gateway_response: gatewayReply,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 7. Write detailed delivery logs for the users to search
      const batch = adminDb.batch();
      recipients.forEach(recipient => {
        const repRef = adminDb!.collection("delivery_reports").doc();
        batch.set(repRef, {
          userId,
          tenantId: userData.tenantId || "unknown",
          recipient,
          message: message,
          status: "delivered",
          transactionId: transactionRef.id,
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();

      return res.json({
        success: true,
        remainingBalance: isSuperAdminBypass ? currentSmsBalance : (currentSmsBalance - requiredCredits),
        recipientsCount: recipients.length,
        requiredCredits,
        transactionId: transactionRef.id
      });
    } catch (err: any) {
      console.error("[SMS Server API Exception]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Verify SMS Package Purchase ---
  app.post("/api/payment/verify", async (req, res) => {
    if (!adminDb) return res.status(500).json({ error: "Firebase DB uninitialized" });

    try {
      const { userId, packageId, paymentProvider, reference } = req.body;

      if (!userId || !packageId) {
        return res.status(400).json({ error: "Missing required checkout parameters: userId or packageId" });
      }

      // 1. Fetch package
      const packageDoc = await adminDb.collection("sms_packages").doc(packageId).get();
      if (!packageDoc.exists) {
        return res.status(404).json({ error: "Selected SMS Package not found" });
      }
      const pkg = packageDoc.data()!;

      // 2. Fetch user
      const userRef = adminDb.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User profile record not found" });
      }
      const userData = userDoc.data()!;

      // 3. Perform balance topup
      const currentBalance = typeof userData.smsBalance === "number" ? userData.smsBalance : 50;
      
      await userRef.update({
        smsBalance: admin.firestore.FieldValue.increment(pkg.smsCount)
      });

      // 4. Trace Log `wallet_transactions`
      const transactionRef = await adminDb.collection("wallet_transactions").add({
        userId,
        tenantId: userData.tenantId || "unknown",
        amount: pkg.price,
        packageId,
        packageName: pkg.name,
        smsCount: pkg.smsCount,
        paymentProvider: paymentProvider || "Mock Gateway",
        reference: reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Emit user feedback alert
      await adminDb.collection("notifications").add({
        userId,
        tenantId: userData.tenantId || "unknown",
        title: "Credit Top-up Approved",
        message: `Your payment has been successfully confirmed. Added ${pkg.smsCount} credits to your SMS Wallet!`,
        type: "billing",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        success: true,
        packagePurchased: pkg.name,
        newSmsBalance: currentBalance + pkg.smsCount,
        transactionId: transactionRef.id
      });
    } catch (err: any) {
      console.error("[Buy verify exception]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Payment Webhook Listener ---
  app.post("/api/payment/webhook", async (req, res) => {
    if (!adminDb) return res.status(200).json({ warning: "DB uninitialized" });

    try {
      console.log("[Payment Webhook Received]:", req.body);
      const { transactionId, status, userId, packageId, paymentProvider, reference } = req.body;

      if (status === "success" && userId && packageId) {
        // Find package details
        const pkgDoc = await adminDb.collection("sms_packages").doc(packageId).get();
        if (pkgDoc.exists) {
          const pkg = pkgDoc.data()!;
          const userRef = adminDb.collection("users").doc(userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            await userRef.update({
              smsBalance: admin.firestore.FieldValue.increment(pkg.smsCount)
            });

            await adminDb.collection("wallet_transactions").add({
              userId,
              tenantId: userDoc.data()?.tenantId || "unknown",
              amount: pkg.price,
              packageId,
              packageName: pkg.name,
              smsCount: pkg.smsCount,
              paymentProvider: paymentProvider || "Webhook Provider",
              reference: reference || `WBH-${Date.now()}`,
              status: "completed",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Payment Webhook Completed]: Credited ${pkg.smsCount} standard SMS to ${userId}`);
          }
        }
      }

      return res.json({ status: "processed" });
    } catch (err: any) {
      console.error("[Payment Webhook error]:", err);
      return res.status(200).json({ error: err.message }); // Respond 200 anyway to prevent webhook retry spam
    }
  });

  // --- Diagnostic connectivity testing endpoint for Administrate Section ---
  app.post("/api/sms/test-connectivity", async (req, res) => {
    const logs: any[] = [];
    logs.push({
      step: "API Call Received",
      status: "info",
      message: "Diagnostics connection initialized to Central SMS Gateway."
    });

    try {
      const { provider, apiKey, apiSecret, senderId, testRecipient, testMessage } = req.body;

      if (!provider || !apiKey) {
        return res.json({
          success: false,
          logs,
          diagnosis: "Validation error: provider and apiKey parameters must be provided."
        });
      }

      const tempConfig = { provider, apiKey, apiSecret, senderId: senderId || "Ecclesia" };
      const client = new SMSProvider(tempConfig);

      logs.push({
        step: "Provider Loaded",
        status: "info",
        message: `Selected Protocol Client: ${provider}. Sender ID: ${tempConfig.senderId}.`
      });

      const recipient = testRecipient || "0555000000";
      const message = testMessage || "Ecclesia central test. Standard ping connectivity ok.";

      logs.push({
        step: "Prepare Transmission Object",
        status: "info",
        message: `Formatting recipient destination: ${recipient}.`
      });

      logs.push({
        step: "Requesting Delivery Broker API",
        status: "info",
        message: `Delivering standard payload to ${provider} API gateway...`
      });

      const result = await client.sendSMS([recipient], message);

      logs.push({
        step: "Gateway Response Handled",
        status: "success",
        message: "API Gateway accepted delivery payload successfully!",
        response: result.rawResponse
      });

      return res.json({
        success: true,
        logs,
        diagnosis: `Central Gateway check succeeded! Provider responded actively and confirmed standard SMS acceptance: ${JSON.stringify(result.rawResponse)}`
      });
    } catch (err: any) {
      logs.push({
        step: "Transmission Rejected",
        status: "error",
        message: `Gateway API connection rejected request: ${err.message}`
      });

      return res.json({
        success: false,
        logs,
        diagnosis: `Diagnostics failed: Please verify your credentials, API Keys, account units balance, or sender registration with your ${req.body.provider} account.`
      });
    }
  });

  // Create Dev Server Setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
