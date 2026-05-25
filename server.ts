import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure JSON and URL-encoded body limit to handle large base64 file payloads
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // Serve uploads directory statically on both dev and production
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // CORS-free Google Drive and Google Apps Script Upload Proxy with zero browser-level blocks
  app.post("/api/gdrive-proxy", async (req, res) => {
    const { action, url, filename, mimeType, base64, accessToken } = req.body;
    console.log(`[gdrive-proxy] Action received: ${action}, file: ${filename}, size: ${base64 ? Math.round(base64.length * 0.75 / 1024) : 0} KB`);

    if (action === "apps_script") {
      if (!url) {
        return res.status(400).json({ error: "Apps Script Web App URL is required." });
      }

      try {
        console.log(`[gdrive-proxy] Forwarding upload to Google Apps Script Web App...`);
        const scriptResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            filename,
            mimeType,
            base64,
          }),
        });

        if (!scriptResponse.ok) {
          const errText = await scriptResponse.text();
          console.error(`[gdrive-proxy] Apps Script returned status ${scriptResponse.status}:`, errText);
          return res.status(scriptResponse.status).json({ error: `Apps Script error: ${errText}` });
        }

        const scriptData = await scriptResponse.json();
        console.log(`[gdrive-proxy] Apps Script upload response:`, scriptData);
        return res.json(scriptData);
      } catch (err: any) {
        console.error(`[gdrive-proxy] Error in Apps Script proxy:`, err);
        return res.status(500).json({ error: `Apps Script proxy connection failed: ${err.message}` });
      }
    }

    if (action === "google_drive") {
      if (!accessToken) {
        return res.status(400).json({ error: "OAuth access token is required." });
      }

      try {
        console.log(`[gdrive-proxy] Standard Google Drive REST API execution via Proxy server...`);
        const parentFolderId = "1qoycH41-DFLKIssqMitdWqkdHP--7LFI";

        // Step 1: Create metadata
        const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: filename,
            mimeType: mimeType || "application/octet-stream",
            parents: [parentFolderId],
          }),
        });

        if (!metadataRes.ok) {
          const errText = await metadataRes.text();
          console.error(`[gdrive-proxy] Google Drive metadata creation failed:`, errText);
          return res.status(metadataRes.status).json({ error: `Google Drive metadata creation failed: ${errText}` });
        }

        const metadata = await metadataRes.json();
        const fileId = metadata.id;

        if (!fileId) {
          return res.status(522).json({ error: "Google Drive failed to generate file ID." });
        }

        // Convert base64 representation to server-side buffer to pipe raw binary
        const fileBuffer = Buffer.from(base64, "base64");

        // Step 2: Upload media
        const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": mimeType || "application/octet-stream",
          },
          body: fileBuffer,
        });

        if (!mediaRes.ok) {
          const errText = await mediaRes.text();
          console.error(`[gdrive-proxy] Google Drive media upload patch failed:`, errText);
          return res.status(mediaRes.status).json({ error: `Google Drive media upload patch failed: ${errText}` });
        }

        // Step 3: Grant public reader permission so URLs can stream/export
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role: "reader",
              type: "anyone",
            }),
          });
        } catch (permErr) {
          console.warn("[gdrive-proxy] Non-blocking permission grant warning:", permErr);
        }

        const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download&name=${encodeURIComponent(filename)}`;
        return res.json({ status: "success", url: directUrl });
      } catch (err: any) {
        console.error(`[gdrive-proxy] Error in standard Google Drive proxy:`, err);
        return res.status(500).json({ error: `Google Drive upload failed inside proxy: ${err.message}` });
      }
    }

    return res.status(400).json({ error: `Unsupported or invalid action: ${action}` });
  });

  // Local file upload endpoint with stream-based piping for ultimate robustness and performance
  app.post("/api/upload", (req, res) => {
    const filename = (req.query.filename as string) || "file";
    console.log(`[Upload] Starting local stream-based upload for: ${filename}`);

    try {
      const decodedFilename = decodeURIComponent(filename);
      const safeFilename = `${Date.now()}_${decodedFilename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      
      const filePath = path.join(uploadsDir, safeFilename);
      console.log(`[Upload] Target write path: ${filePath}`);
      
      const writeStream = fs.createWriteStream(filePath);
      
      req.on("error", (err) => {
        console.error("[Upload] Request stream read error:", err);
        writeStream.close();
        if (!res.headersSent) {
          res.status(500).json({ error: `Request stream read error: ${err.message}` });
        }
      });

      writeStream.on("error", (err) => {
        console.error("[Upload] Write stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: `Server storage write error: ${err.message}` });
        }
      });

      writeStream.on("finish", () => {
        console.log(`[Upload] File upload successfully completed: ${safeFilename}`);
        if (!res.headersSent) {
          res.json({ url: `/uploads/${safeFilename}` });
        }
      });

      req.pipe(writeStream);
    } catch (error: any) {
      console.error("[Upload] Catch-all initialization error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: `File upload initialization error: ${error.message}` });
      }
    }
  });

  // Vite middleware for development
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
    console.log(`Full-stack server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
