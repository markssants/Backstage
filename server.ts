import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
