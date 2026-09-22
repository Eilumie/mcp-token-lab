import { createLedger, summarize } from "./accounting.js";

export function calculateFullLoad(p, rate, coldStart = false) {
  let context = p.agent_prompt + p.full_tools_schema + p.skills_discovery_list;
  const initial_context = context;
  let total_in_cache = 0;
  let total_in_new = 0;
  let total_out = 0;
  let input = context;
  let in_cache, in_new, out;
  const requests = [];
  const ledger = createLedger({
    "Agent Prompt": p.agent_prompt,
    "Tools Schema": p.full_tools_schema,
    "Skills List": p.skills_discovery_list,
  });

  for (let round = 1; round <= p.rounds; round++) {
    // 1. 读取技能计划：保留原公式的请求、累计与上下文更新顺序。
    {
      const input_before = input;
      const context_before = context;
      ledger.append("用户消息", p.user_message);
      in_cache = input;
      in_new = p.user_message + context - input;
      out = p.read_skills_plan;
      const logical_new = in_new;
      const cold = coldStart && round === 1;
      if (cold) {
        in_cache = 0;
        in_new += initial_context;
      }
      const attribution = ledger.request("读取技能计划", out, cold);
      total_in_cache += in_cache;
      total_in_new += in_new;
      total_out += out;
      input += logical_new;
      const tool_result = p.skill_content * p.skills_per_round;
      context = input + out + tool_result;
      requests.push({
        round,
        stage: "读取技能计划",
        input_before,
        context_before,
        in_cache,
        in_new,
        out,
        tool_result,
        input_after: input,
        context_after: context,
        total_in_cache,
        total_in_new,
        total_out,
        attribution,
        cold,
        user_message: p.user_message,
        first: true,
      });
      ledger.append("读取技能计划", out);
      ledger.append("Skills 内容", tool_result);
    }

    // 2. 调用工具计划：保留原公式的请求、累计与上下文更新顺序。
    {
      const input_before = input;
      const context_before = context;
      in_cache = input;
      in_new = context - input;
      out = p.call_tools_plan;
      const logical_new = in_new;
      const cold = false;
      if (cold) {
        in_cache = 0;
        in_new += initial_context;
      }
      const attribution = ledger.request("调用工具计划", out, cold);
      total_in_cache += in_cache;
      total_in_new += in_new;
      total_out += out;
      input += logical_new;
      const tool_result = p.tool_result * p.tools_per_round;
      context = input + out + tool_result;
      requests.push({
        round,
        stage: "调用工具计划",
        input_before,
        context_before,
        in_cache,
        in_new,
        out,
        tool_result,
        input_after: input,
        context_after: context,
        total_in_cache,
        total_in_new,
        total_out,
        attribution,
        cold,
        user_message: 0,
        first: false,
      });
      ledger.append("调用工具计划", out);
      ledger.append("Tools Result", tool_result);
    }

    // 3. Agent 最终回复：保留原公式的请求、累计与上下文更新顺序。
    {
      const input_before = input;
      const context_before = context;
      in_cache = input;
      in_new = context - input;
      out = p.agent_reply;
      const logical_new = in_new;
      const cold = false;
      if (cold) {
        in_cache = 0;
        in_new += initial_context;
      }
      const attribution = ledger.request("Agent 最终回复", out, cold);
      total_in_cache += in_cache;
      total_in_new += in_new;
      total_out += out;
      input += logical_new;
      const tool_result = 0;
      context = input + out + tool_result;
      requests.push({
        round,
        stage: "Agent 最终回复",
        input_before,
        context_before,
        in_cache,
        in_new,
        out,
        tool_result,
        input_after: input,
        context_after: context,
        total_in_cache,
        total_in_new,
        total_out,
        attribution,
        cold,
        user_message: 0,
        first: false,
      });
      ledger.append("Agent 最终回复", out);
    }
  }
  return summarize(
    {
      requests,
      ledger,
      initial_context,
      context,
      total_in_cache,
      total_in_new,
      total_out,
    },
    rate,
  );
}
