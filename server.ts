import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parser for API endpoints
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

  // AI Contract auto-fill / parsing endpoint
  app.post("/api/contracts/autofill", async (req, res) => {
    try {
      const { templateText, clientData, customInstructions } = req.body;
      if (!templateText) {
        return res.status(400).json({ error: "O texto ou modelo do contrato é obrigatório." });
      }

      const client = getGeminiClient();
      if (client) {
        const prompt = `Você é um assistente jurídico e administrativo de alta precisão especializado em contratos de prestação de serviços de marketing, design e eventos.
Sua tarefa é receber o documento ou modelo de contrato fornecido pelo usuário e preencher rigorosamente e automaticamente todos os campos, lacunas ou placeholders (ex: [QUALIFICAÇÃO COMPLETA], [Nome], [CPF], [000.000.000-00], [R$ 0,00], [Cidade], [Data], etc.) com base nas informações cadastradas do cliente e do evento informadas abaixo.

--- DADOS CADASTRADOS DO CLIENTE E DO EVENTO ---
${JSON.stringify(clientData, null, 2)}
------------------------------------------------

--- INSTRUÇÕES ADICIONAIS DO USUÁRIO ---
${customInstructions || "Preencha todas as variáveis do contrato mantendo a estrutura jurídica, cláusulas e termos integrais intactos."}

--- DOCUMENTO / MODELO DE CONTRATO ENVIADO ---
${templateText}
---------------------------------------------

Retorne um JSON com a seguinte estrutura:
{
  "filledText": "Texto completo do contrato com todos os dados preenchidos de forma impecável",
  "contractTitle": "Título identificado do contrato",
  "contractorName": "Nome do contratante preenchido",
  "contractValue": "Valor total preenchido",
  "fieldsReplaced": ["lista de campos e variáveis que foram identificados e preenchidos"]
}`;

        const response = await client.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "{}";
        try {
          const parsed = JSON.parse(rawText);
          return res.json({
            success: true,
            ...parsed,
          });
        } catch (parseErr) {
          return res.json({
            success: true,
            filledText: rawText,
            contractTitle: "Contrato de Prestação de Serviços",
            fieldsReplaced: ["Campos preenchidos com IA"],
          });
        }
      } else {
        // Fallback rule-based replacement when Gemini API Key is not set
        let filled = templateText;
        const replacements: Record<string, string> = {
          "[QUALIFICAÇÃO COMPLETA CONTRATANTE]": `CONTRATANTE: ${clientData.contractorName || "Contratante"}`,
          "[Nome do Contratante]": clientData.contractorName || "",
          "[Iago Pavarote da Silva Moura]": clientData.contractorName || "Iago Pavarote da Silva Moura",
          "[pavarote75@gmail.com]": clientData.contractorEmail || clientData.email || "",
          "[021.255.892-73]": clientData.contractorCpf || "021.255.892-73",
          "[Minas Gerais]": clientData.state || "Minas Gerais",
          "[Belo Horizonte]": clientData.city || "Belo Horizonte",
          "[4]": String(clientData.durationMonths || 4),
          "[01/05/2026]": clientData.startDate || clientData.eventDate || "01/05/2026",
          "[R$ (700)]": clientData.paymentValue || "R$ 700,00",
          "[30]": String(clientData.artCount || 30),
          "[15]": String(clientData.motionCount || 15),
        };

        const replacedList: string[] = [];
        for (const [key, val] of Object.entries(replacements)) {
          if (filled.includes(key) && val) {
            filled = filled.split(key).join(val);
            replacedList.push(key);
          }
        }

        return res.json({
          success: true,
          filledText: filled,
          contractTitle: "Contrato de Prestação de Serviços",
          fieldsReplaced: replacedList,
        });
      }
    } catch (error: any) {
      console.error("[Contract AutoFill Error]:", error);
      res.status(500).json({ error: error.message || "Erro ao processar contrato" });
    }
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
