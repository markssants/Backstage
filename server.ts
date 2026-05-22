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

  // Local file upload endpoint with 50MB limit
  app.post("/api/upload", (req, res) => {
    const filename = (req.query.filename as string) || "file";
    try {
      const decodedFilename = decodeURIComponent(filename);
      const safeFilename = `${Date.now()}_${decodedFilename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      
      const filePath = path.join(uploadsDir, safeFilename);
      const writeStream = fs.createWriteStream(filePath);
      
      let receivedBytes = 0;
      const maxBytes = 50 * 1024 * 1024; // 50MB limit

      req.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) {
          writeStream.destroy();
          req.destroy(new Error("File too large"));
          if (!res.headersSent) {
            res.status(413).json({ error: "File exceeds 50MB limit." });
          }
        }
      });

      req.pipe(writeStream);

      writeStream.on("finish", () => {
        if (!res.headersSent) {
          res.json({ url: `/uploads/${safeFilename}` });
        }
      });

      writeStream.on("error", (err) => {
        console.error("Local file upload write error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error writing file to local server storage." });
        }
      });
    } catch (error) {
      console.error("Local file upload error in payload:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "File upload initialization failed on server." });
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
