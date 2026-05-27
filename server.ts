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
        // Arkesel API v1/v2 endpoint
        const response = await fetch("https://open.arkesel.com/api/v1/sms/send", {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            sender: senderId,
            message: message,
            recipients: cleanedRecipients
          })
        });

        const resData = await response.json() as any;
        console.log("[Arkesel Response]", resData);

        if (response.ok && (resData.status === "success" || resData.code === "1000" || resData.code === 1000 || resData.status === 1000)) {
          return res.json({ success: true, provider: "arkasel", info: resData });
        } else {
          throw new Error(resData.message || resData.status || JSON.stringify(resData));
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
