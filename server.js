import express from "express";
import cors from "cors";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = new McpServer({
  name: "LeadSync",
  version: "1.0.0"
});

server.tool(
  "generate_outreach",
  "Generate a cold outreach message for a prospect company.",
  {
    company: z.string().min(1).describe("The prospect company name"),
    product: z.string().min(1).describe("The product or service being offered")
  },
  async ({ company, product }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hi there,

I noticed ${company} may be growing quickly. A lot of teams at that stage run into bottlenecks around lead handling, follow-up speed, and appointment setting.

We help companies improve that with ${product}.

Would you be open to a quick 10-minute conversation next week?`
        }
      ]
    };
  }
);

server.tool(
  "score_lead",
  "Score a lead based on basic fit.",
  {
    company: z.string().min(1).describe("The prospect company name"),
    industry: z.string().min(1).describe("The prospect industry"),
    employees: z.number().int().positive().describe("Approximate employee count")
  },
  async ({ company, industry, employees }) => {
    let score = 5;

    if (["saas", "software", "marketing", "sales"].includes(industry.toLowerCase())) {
      score += 2;
    }

    if (employees >= 10 && employees <= 500) {
      score += 2;
    }

    if (employees > 500) {
      score += 1;
    }

    return {
      content: [
        {
          type: "text",
          text: `${company} lead score: ${Math.min(score, 10)}/10`
        }
      ]
    };
  }
);

const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports[sessionId] = transport;

  res.on("close", () => {
    delete transports[sessionId];
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];

  if (!transport) {
    res.status(400).send("No transport found for sessionId");
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LeadSync MCP server running on http://localhost:${PORT}/sse`);
});