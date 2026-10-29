# GitHub repository metadata

## Description (paste into About → Description)

Visualize and compare MCP agent context strategies: tool loading, token usage, prompt caching, compression, and estimated LLM costs. No API keys required.

## Website (About → Website)

https://zhanghongen.github.io/mcp-token-lab/

## Topics (About → Topics)

mcp, model-context-protocol, ai-agents, context-engineering, token-optimization, prompt-caching, context-compression, llm, llm-cost, tool-calling, tool-discovery, cost-analysis, simulation, developer-tools, vue3

## Short positioning statement

MCP Token Lab is a browser-based simulator for exploring the token and cost trade-offs of tool loading, cache reuse, and context compression in multi-turn agent workflows. It uses configurable accounting assumptions rather than real model calls or benchmark traces.

## Recommended repository metadata correction

The existing `package.json` points its repository, homepage and bugs links at `zhangHongEn/token-lab`, while the actual public repository is `zhangHongEn/mcp-token-lab`. Update them to:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/zhangHongEn/mcp-token-lab.git"
  },
  "homepage": "https://zhanghongen.github.io/mcp-token-lab/",
  "bugs": {
    "url": "https://github.com/zhangHongEn/mcp-token-lab/issues"
  }
}
```

This is a suggested metadata snippet, not a complete replacement package.json.

## Screenshot provenance

The screenshots in `docs/screenshots/` are crops of the full-page screenshot supplied for this request, from the English-language MCP Token Lab interface. They reflect that captured UI state; they are **not** new live-browser captures of interactive dialogs. Feature labels and detailed explanations were cross-checked against the public GitHub README, package.json, simulation-model documentation, and reproducible-example documentation. Replace the screenshots after UI changes or when you want clean high-resolution captures of dialogs and controls.