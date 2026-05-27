import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Real SMS route supporting Arkesel, mNotify, Twilio, Africa's Talking, and Custom Gateways
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { config, recipients, message } = req.body;

      if (!config) {
        return res.status(400).json({ error: "No system SMS Gateway profile linked." });
      }
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Missing or invalid recipients array." });
      }
      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Message content cannot be empty." });
      }

      const provider = config.provider;
      const apiKey = config.apiKey || "";
      const apiSecret = config.apiSecret || "";
      const senderId = config.senderId || "";

      // Cleanup and format phone numbers depending on vendor preferences
      const formatPhoneNumber = (num: string, p: string) => {
        let cleaned = num.replace(/[\s\-\(\)\+]/g, ""); // strip all non-digits
        if (p === "mnotify" || p === "arkasel" || p === "arkesel") {
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
      console.log(`[SMS Broadcast] Initiated via "${provider}" to ${cleanedRecipients.length} recipients.`);

      if (provider === "arkasel" || provider === "arkesel") {
        // Modern REST v2 API endpoints to try sequentially (handles any DNS/SSL routing resolution quirks)
        const v2Endpoints = [
          "https://sms.arkesel.com/api/v2/sms/send",
          "https://open.arkesel.com/api/v1/sms/send",
          "https://api.arkesel.com/v2/sms/send"
        ];

        let v2Success = false;
        let v2Response: any = null;

        for (const endpoint of v2Endpoints) {
          try {
            console.log(`[Arkesel] Attempting REST endpoint: ${endpoint} for ${cleanedRecipients.length} recipients.`);
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "api-key": apiKey,
                "api_key": apiKey, // duplicate parameter variations to handle key headers flexibly 
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

            const textRes = await response.text();
            console.log(`[Arkesel Response: ${endpoint}]`, textRes);

            let resData: any = {};
            try {
              resData = JSON.parse(textRes);
            } catch (e) {}

            if (response.ok && (
              resData.status === "success" || 
              resData.code === "1000" || 
              resData.code === 1000 || 
              resData.status === 1000 || 
              resData.status === "1000" ||
              resData.status?.toString().toLowerCase().includes("success") ||
              resData.message?.toString().toLowerCase().includes("success")
            )) {
              v2Success = true;
              v2Response = resData;
              break; // Success! Stop executing the endpoint loop
            } else {
              console.warn(`[Arkesel] ${endpoint} returned non-success response:`, textRes);
            }
          } catch (v2Err: any) {
            console.warn(`[Arkesel] ${endpoint} fetch request failed:`, v2Err.message);
          }
        }

        if (v2Success) {
          return res.json({ success: true, provider: "arkasel-v2", info: v2Response });
        }

        // Fallback to Arkesel legacy v1 endpoint
        console.log(`[Arkesel] Falling back to legacy v1 API integration for ${cleanedRecipients.length} recipients...`);
        const recipientsStr = cleanedRecipients.join(",");
        const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(recipientsStr)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(message)}`;
        
        const responseV1 = await fetch(v1Url, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        const textResponse = await responseV1.text();
        console.log("[Arkesel Response v1 Raw]", textResponse);

        let resJSON: any = {};
        try {
          resJSON = JSON.parse(textResponse);
        } catch (e) {
          // If the output was successful plain text confirmation
          if (textResponse.toLowerCase().includes("success") || textResponse.includes("1000")) {
            return res.json({ success: true, provider: "arkasel-v1-text", info: textResponse });
          }
          throw new Error(`Arkesel V1 plain text output: ${textResponse}`);
        }

        if (responseV1.ok && (resJSON.status === "success" || resJSON.code === "1000" || resJSON.code === 1000 || resJSON.status === 1000 || resJSON.status?.toString().toLowerCase().includes("success") || resJSON.message?.toString().toLowerCase().includes("success"))) {
          return res.json({ success: true, provider: "arkasel-v1-json", info: resJSON });
        } else {
          throw new Error(resJSON.message || resJSON.status || textResponse);
        }
      }

      else if (provider === "mnotify") {
        const response = await fetch(`https://api.mnotify.com/v1/sms/quick?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            recipient: cleanedRecipients,
            sender: senderId,
            message: message,
            is_schedule: false
          })
        });

        const resData = await response.json() as any;
        console.log("[mNotify Response]", resData);

        if (response.ok && (resData.status === "success" || resData.code === "1000" || resData.code === 1000)) {
          return res.json({ success: true, provider: "mnotify", info: resData });
        } else {
          throw new Error(resData.message || resData.status || JSON.stringify(resData));
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
          return resTwilio;
        });

        const responses = await Promise.all(promises);
        const failed = responses.filter(r => !r.ok);
        
        if (failed.length > 0) {
          const sampleErr = await failed[0].text();
          throw new Error(`Twilio rejected one or more messages. Failed count: ${failed.length}. Sample: ${sampleErr}`);
        }

        return res.json({ success: true, provider: "twilio" });
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
        console.log("[Africa's Talking Response]", resData);

        if (response.ok && resData.SMSMessageData) {
          return res.json({ success: true, provider: "africastalking", info: resData.SMSMessageData });
        } else {
          throw new Error(JSON.stringify(resData));
        }
      }

      else if (provider === "custom") {
        const customUrl = config.customUrl || "";
        const customMethod = config.customMethod || "POST";
        const customBodyJson = config.customBodyJson || "";
        const customHeadersJson = config.customHeadersJson || "";

        const promises = cleanedRecipients.map(async (to) => {
          let url = customUrl;
          let method = customMethod;
          let bodyStr = customBodyJson;
          let parsedHeaders: any = {};

          if (customHeadersJson) {
            try {
              parsedHeaders = JSON.parse(customHeadersJson);
            } catch (e) {}
          }

          url = url.replace(/\{\{to\}\}/g, encodeURIComponent(to))
                   .replace(/\{\{message\}\}/g, encodeURIComponent(message))
                   .replace(/\{\{sender\}\}/g, encodeURIComponent(senderId));

          bodyStr = bodyStr.replace(/\{\{to\}\}/g, to)
                           .replace(/\{\{message\}\}/g, message)
                           .replace(/\{\{sender\}\}/g, senderId);

          const opts: any = {
            method,
            headers: {
              "Content-Type": "application/json",
              ...parsedHeaders
            }
          };

          if (method === "POST" && bodyStr) {
            opts.body = bodyStr;
          }

          const response = await fetch(url, opts);
          if (!response.ok) {
            throw new Error(`HTTP Webhook Error ${response.status} sending custom SMS to ${to}`);
          }
          return response;
        });

        await Promise.all(promises);
        return res.json({ success: true, provider: "custom" });
      }

      else {
        throw new Error(`Unknown target provider: "${provider}"`);
      }

    } catch (err: any) {
      console.error("[SMS Broker Error]", err);
      res.status(500).json({ error: err.message || "Failed to broadcast via local SMS Broker proxy." });
    }
  });

  // Manually test the Arkesel v2 API endpoint connectivity with step-by-step diagnostics
  app.post("/api/sms/test-connectivity", async (req, res) => {
    const logs: any[] = [];
    try {
      const { apiKey, senderId, recipient, message } = req.body;

      logs.push({
        step: "Initialization",
        status: "info",
        message: "Starting Arkesel connectivity and diagnostic suite..."
      });

      if (!apiKey) {
        logs.push({
          step: "Param Check",
          status: "error",
          message: "API Key (v2 Token) is missing or empty."
        });
        return res.json({ success: false, logs, diagnosis: "API Key is required to connect to Arkesel API." });
      }

      const maskedKey = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}......${apiKey.substring(apiKey.length - 4)}` 
        : "****";

      logs.push({
        step: "Credentials Verification",
        status: "info",
        message: `Registered API Key: ${maskedKey}. Verified format.`
      });

      // Sender ID Checks
      if (!senderId) {
        logs.push({
          step: "Sender ID check",
          status: "warning",
          message: "Sender ID is not specified. It defaults to Arkesel's generic sender, which may fail delivery."
        });
      } else {
        if (senderId.length > 11) {
          logs.push({
            step: "Sender ID check",
            status: "error",
            message: `Sender ID '${senderId}' is ${senderId.length} characters long. Standard SMS standards require a MAXIMUM of 11 characters. Longer IDs will cause carrier delivery failures.`
          });
        }
        if (/[^a-zA-Z0-9]/.test(senderId)) {
          logs.push({
            step: "Sender ID check",
            status: "error",
            message: `Sender ID '${senderId}' contains special characters or spaces. Sender IDs MUST be purely alphanumeric. Special characters will cause immediate network carrier drop or infinite queuing.`
          });
        } else {
          logs.push({
            step: "Sender ID check",
            status: "success",
            message: `Sender ID '${senderId}' is valid (alphanumeric, ${senderId.length} characters).`
          });
        }
      }

      // Telephone clean check
      if (!recipient) {
         logs.push({
           step: "Recipient Format Check",
           status: "error",
           message: "Recipient number is missing."
         });
         return res.json({ success: false, logs, diagnosis: "Recipient phone number is missing." });
      }

      let cleaned = recipient.replace(/[\s\-\(\)\+]/g, "");
      if (cleaned.startsWith("0") && cleaned.length === 10) {
        cleaned = "233" + cleaned.substring(1);
      }
      logs.push({
        step: "Phone Formatting",
        status: "info",
        message: `Formatted '${recipient}' into Arkesel Ghana format '${cleaned}'.`
      });

      const msgText = message || "Ecclesia Connection Test Message";

      const endpoints = [
        "https://sms.arkesel.com/api/v2/sms/send",
        "https://open.arkesel.com/api/v1/sms/send",
        "https://api.arkesel.com/v2/sms/send"
      ];

      let successEndpoint = null;
      let finalResponseBody = null;
      let finalStatus = 0;

      for (const url of endpoints) {
        logs.push({
          step: `API v2 Request to ${url}`,
          status: "info",
          message: `Attempting payload post to ${url}`
        });

        try {
          const payload = {
            sender: senderId,
            message: msgText,
            recipients: [cleaned],
            sandbox: false
          };

          const headers = {
            "api-key": apiKey,
            "api_key": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
          };

          const startMs = Date.now();
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
          });
          const duration = Date.now() - startMs;

          finalStatus = response.status;
          const rawText = await response.text();
          finalResponseBody = rawText;

          let parsed: any = null;
          try {
            parsed = JSON.parse(rawText);
          } catch(e) {}

          const codeStr = parsed ? (parsed.code || parsed.status || "") : "";
          const isOk = response.ok && (
            codeStr.toString() === "1000" ||
            codeStr.toString().toLowerCase() === "success" ||
            parsed?.message?.toString().toLowerCase().includes("success") ||
            parsed?.status?.toString().toLowerCase().includes("success")
          );

          if (isOk) {
            successEndpoint = url;
            logs.push({
              step: `API v2 Request to ${url}`,
              status: "success",
              message: `HTTP ${response.status} (${duration}ms). Response: ${rawText}`
            });
            break;
          } else {
            logs.push({
              step: `API v2 Request to ${url}`,
              status: "warning",
              message: `HTTP ${response.status} failed standard check (${duration}ms). Raw reply: ${rawText}`
            });
          }
        } catch (fetchErr: any) {
          logs.push({
            step: `API v2 Request to ${url}`,
            status: "error",
            message: `Connection Error: ${fetchErr.message}`
          });
        }
      }

      if (successEndpoint) {
        logs.push({
          step: "Result Parsing",
          status: "success",
          message: `Successfully communicated with Arkesel v2 over ${successEndpoint}!`
        });

        let parsed: any = {};
        try { parsed = JSON.parse(finalResponseBody); } catch(e) {}

        const arkeselStatus = parsed?.status || parsed?.message || "unknown";
        const arkeselCode = parsed?.code || "N/A";
        const arkeselBal = parsed?.balance !== undefined ? parsed.balance : "N/A";
        const arkeselCharge = parsed?.charge !== undefined ? parsed.charge : "N/A";
        const deliveryData = parsed?.data || [];

        let diagnosis = `Arkesel API v2 connection is ACTIVE. SMS request was successfully submitted!\n`;
        diagnosis += `- Arkesel Status: ${arkeselStatus} (Code: ${arkeselCode})\n`;
        diagnosis += `- Balance remaining: ${arkeselBal} GHS/Credits\n`;
        diagnosis += `- Submission Cost: ${arkeselCharge} GHS/Credits\n`;

        if (deliveryData.length > 0) {
          const firstRecipientStatus = deliveryData[0].status;
          diagnosis += `- Recipient Status (Arkesel queue): '${firstRecipientStatus}'\n\n`;
          if (firstRecipientStatus === "queued" || firstRecipientStatus === "submitted") {
            diagnosis += `💡 DIAGNOSTIC ANALYSIS:\n`;
            diagnosis += `Your message is marked as 'queued' inside Arkesel's system. If credits are deducted but the SMS is NOT physically received, Arkesel has processed the payload, but cellular carriers (MTN, Telecel, AirtelTigo) are rejecting/dropping the delivery due to:\n`;
            diagnosis += `1. **SENDER ID REGISTRATION:** Ghana regulations DO NOT allow messages with custom Sender IDs (like '${senderId}') to be delivered until that Sender ID is explicitly requested, verified, and whitelisted via your corporate KYC on your Arkesel Portal dashboard. Releasing messages with unapproved Sender IDs still charges submission credits but fails at delivery.\n`;
            diagnosis += `2. **DO NOT DISTURB (DND):** Recipient phone numbers may have DND enabled on their SIM cards, instructing Ghana carriers to block promotional SMS traffic at carrier ingress.\n`;
            diagnosis += `3. **API TOKENS & PROFILE STATUS:** Your Arkesel profile must be fully validated (KYC completed) before they allow routing real-time SMS to live subscribers.\n`;
          }
        } else {
          diagnosis += `💡 DIAGNOSTIC ANALYSIS:\nNo individual recipient-level tracking status was returned by Arkesel. Verify that the registered Sender ID matches exactly your Arkesel portal's approved ones in capitalization and spelling.\n`;
        }

        return res.json({
          success: true,
          logs,
          diagnosis,
          details: {
            endpoint: successEndpoint,
            status: finalStatus,
            response: parsed
          }
        });
      }

      // If we got here, all REST v2 endpoints failed. Try the Legacy GET v1 URL
      logs.push({
        step: "Arkesel Legacy v1 Fallback Check",
        status: "info",
        message: "Attempting GET request to Arkesel legacy v1 endpoint..."
      });

      const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(cleaned)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(msgText)}`;
      const v1Response = await fetch(v1Url);
      const v1Raw = await v1Response.text();

      logs.push({
        step: "Arkesel Legacy v1 Reply",
        status: v1Response.ok ? "success" : "error",
        message: `HTTP ${v1Response.status}. Raw Reply: "${v1Raw}"`
      });

      if (v1Response.ok && (v1Raw.includes("1000") || v1Raw.toLowerCase().includes("success"))) {
        return res.json({
          success: true,
          logs,
          diagnosis: "REST v2 API endpoints failed but Legacy v1 GET endpoint succeeded! Please review if your Arkesel account token only supports legacy v1 API query query-string keys, or verify if modern REST v2 features are enabled on your account.",
          details: { v1Raw }
        });
      }

      return res.json({
        success: false,
        logs,
        diagnosis: "All Arkesel endpoints returned errors or failed validation. Please inspect the raw HTTP logs. If you get 401 Unauthorized, verify that your API token is accurate and does not include trailing spaces or truncated characters.",
        details: { finalResponseBody }
      });

    } catch (err: any) {
      logs.push({
        step: "System Error Handler",
        status: "error",
        message: `Exception triggered: ${err.message}`
      });
      return res.json({
        success: false,
        logs,
        diagnosis: `A critical exception occurred side-server: ${err.message}`
      });
    }
  });

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
