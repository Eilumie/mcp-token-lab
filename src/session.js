
class Action{
  type = "action"
  constructor({text, token, session}) {
    this.token = token
    this.session = session
    this.actionIndex = session.actionIndex++
    this.text = `${this.actionIndex}-${text}`
    this.group = text
  }
}
class LLMAction extends Action{
  constructor({input, output, session}) {
    super({text: "llm next plan", session})
    this.type = "llm"
    this.session = session
    this.input = input
    const {notCachedIndex, cachedToken, notCachedToken, actionGroupTokens} = this.matchCached()
    this.notCachedIndex = notCachedIndex
    this.cachedToken = cachedToken
    this.notCachedToken = notCachedToken
    this.actionGroupTokens = actionGroupTokens
    this.output = output

  }
  matchCached() {
    // 匹配prefix命中缓存
    const inputActions = this.input.turns.map(turn => turn.actions).flat()
    const compressionKeptActions = new Set(this.input.turns
      .filter(turn => turn.compressionKept)
      .flatMap(turn => turn.actions))
    let prevLLM = null
    for (let index = inputActions.length - 1; index > -1; index--) {
      const action = inputActions[index];
      if (action.type === "llm") {
        prevLLM = action
        break;
      }
    }
    let notCachedIndex = null
    if (prevLLM) {
      const prevLLMInputActions = prevLLM.input.turns.map(turn => turn.actions).flat()
      notCachedIndex = prevLLMInputActions.length
      for(let i = 0; i < prevLLMInputActions.length; i++) {
        // 设计即为判断引用
        if (prevLLMInputActions[i] !== inputActions[i]) {
          notCachedIndex = i;
          break
        }
      }
    }
    if (!prevLLM) {
      // 首次initialContext很容易命中缓存, 因此算命中缓存
      const initialContext = this.session.getInitialContext()
      notCachedIndex = initialContext.length
    }
    const cachedActions = inputActions.slice(0, notCachedIndex).filter(item => item.type !== "llm")
    const notCachedActions = inputActions.slice(notCachedIndex).filter(item => item.type !== "llm")
    const cachedToken = cachedActions.reduce((total, item) => total + item.token, 0);
    const notCachedToken = notCachedActions.reduce((total, item) => total + item.token, 0);;

    const cachedActionsGroup = cachedActions.reduce((acc, item) => {
      const group = compressionKeptActions.has(item) ? "compression retained turns" : item.group;

      if (!acc[group]) {
        acc[group] = [];
      }

      acc[group].push(item);
      return acc;
    }, {});
    const notCachedActionsGroup = notCachedActions.reduce((acc, item) => {
      const group = compressionKeptActions.has(item) ? "compression retained turns" : item.group;

      if (!acc[group]) {
        acc[group] = [];
      }

      acc[group].push(item);
      return acc;
    }, {});
    Object.keys(cachedActionsGroup).forEach(key => {
      notCachedActionsGroup[key] = notCachedActionsGroup[key] || []
    })
    Object.keys(notCachedActionsGroup).forEach(key => {
      cachedActionsGroup[key] = cachedActionsGroup[key] || []
    })

    const actionGroupTokens = {}
    Object.keys(cachedActionsGroup).forEach(group => {
      cachedActionsGroup[group].cachedToken = cachedActionsGroup[group].reduce((total, item) => total + item.token, 0);
      const originCachedToken = cachedActionsGroup[group].cachedToken
      actionGroupTokens[group] = {
        cachedToken: originCachedToken * this.session.config.expectedPrefixCacheHitRate,
        notCachedToken: notCachedActionsGroup[group].reduce((total, item) => total + item.token, 0) + originCachedToken * (1-this.session.config.expectedPrefixCacheHitRate)
      }
    })

    return {
      notCachedIndex,
      cachedToken: cachedToken * this.session.config.expectedPrefixCacheHitRate,
      notCachedToken: notCachedToken + cachedToken * (1-this.session.config.expectedPrefixCacheHitRate),
      actionGroupTokens
    }
  }
}


class Turn{
  constructor({index, session}) {
    this.session = session
    this.type = "turn"
    this.index = index
    this.actions = []
  }

  runPlan() {
    const userMessageAction = new Action({text: "user_message", token: this.session.config.userMessageToken, session: this.session})
    this.actions.push(userMessageAction)
    let userMessageSnapshot = this.session.getContextSnapshot()

    let LLM = new LLMAction({
      input: userMessageSnapshot, 
      output: new Action({text: "read_skills_plan", token: this.session.config.readSkillPlanToken, session: this.session}),
      session: this.session
    })
    this.actions.push(LLM)
    this.actions.push(LLM.output)

    const readSkillsAction = new Action({text: "read_skills", token: this.session.config.skillDetailToken * this.session.config.turnAvgSkillsCount, session: this.session})
    this.actions.push(readSkillsAction)
    let skillsDetailSnapshot = this.session.getContextSnapshot()

    let toolsSchemaSnapshot = null
    if (this.session.config.toolsMode === "LAZY_TOOLS_SCHEMA") {
      LLM = new LLMAction({
        input: skillsDetailSnapshot, 
        output: new Action({text: "get_tools_schema_plan", token: this.session.config.schemaPlanToken, session: this.session}),
        session: this.session
      })
      this.actions.push(LLM)
      this.actions.push(LLM.output) 
      const getToolsSchemaAction = new Action({text: "get_tools_schema", token: this.session.config.toolSchemaToken * this.session.config.turnAvgToolsCount, session: this.session})
      this.actions.push(getToolsSchemaAction)
      toolsSchemaSnapshot = this.session.getContextSnapshot()
    }

    LLM = new LLMAction({
      input: this.session.config.toolsMode === "LAZY_TOOLS_SCHEMA" ? toolsSchemaSnapshot : skillsDetailSnapshot,
      output: new Action({text: "call_tools_plan", token: this.session.config.callToolsPlanToken, session: this.session}),
      session: this.session
    })
    this.actions.push(LLM)
    this.actions.push(LLM.output)

    const callToolsAction = new Action({text: "call_tools", token: this.session.config.toolResultToken * this.session.config.turnAvgToolsCount, session: this.session})
    this.actions.push(callToolsAction)
    let toolsResultSnapshot = this.session.getContextSnapshot()

    LLM = new LLMAction({
      input: toolsResultSnapshot, 
      output: new Action({text: "agent_result", token: this.session.config.agentResult, session: this.session}),
      session: this.session
    })
    this.actions.push(LLM)
    this.actions.push(LLM.output)

    if (
      (this.session.config.compressionThresholdType === "TOKEN" &&
        (LLM.cachedToken + LLM.notCachedToken + LLM.output.token >= this.session.config.compressionThresholdToken)
      ) ||
      (this.session.config.compressionThresholdType === "TURN" &&
        (this.session.getContextSnapshot().turns.filter(turn =>
          turn.actions.some(action => action.group === "user_message")
        ).length >= this.session.config.compressionThresholdTurnCount)
      )
    ) {
      this.session.doCompress()
    }
  }
}

class Session {
  constructor(config = {}) {
    // 嵌套配置按字段合并，配置不写入 session 的运行状态。
    this.config = {
      ...this.config,
      ...config,
      initialContext: {...this.config.initialContext, ...config.initialContext},
      model: {...config.model},
    }
    this.validateCompressionConfig()

    this.actionIndex = 0
    this.initialContext = {
      agentPrompt: new Action({text: "agent prompt", token: this.config.initialContext.agentPromptToken, session: this}),
      skillsDiscoverList: new Action({text: "skills discover list", token: 0, session: this}),
      toolsIndexList: new Action({text: "tools discover list", token: 0, session: this}),
      toolsSchemaList: new Action({text: "tools schema list", token: 0, session: this}),
      roleAllowTools: new Action({text: "role allow tools", token: 0, session: this}),
    }

    this.initialContext.skillsDiscoverList.token = this.config.skillIndexToken * this.config.skillsTotalCount
    this.initialContext.toolsIndexList.token = this.config.toolsTotalCount * this.config.toolsIndexToken
    this.initialContext.toolsSchemaList.token = this.config.toolsTotalCount * this.config.toolSchemaToken
    this.initialContext.roleAllowTools.token = this.initialContext.toolsIndexList.token * this.config.sessionAvgAllowToolsRate
  }
  
  config = {
    initialContext: {
      agentPromptToken: 4,
    },
    turnTotalCount: 100,
    // 只在结果计算的时候
    expectedPrefixCacheHitRate: 0.9,
    skillsTotalCount: 30,
    toolsTotalCount: 90,
    turnAvgSkillsCount: 0.33,
    turnAvgToolsCount: 1.5,
    sessionAvgAllowToolsRate: 0.7,
    skillIndexToken: 0.1,
    toolsIndexToken: 0.013,
    toolSchemaToken: 0.51,
    userMessageToken: 0.1,
    skillDetailToken: 3,
    toolResultToken: 3,
    readSkillPlanToken: 0.1,
    schemaPlanToken: 0.1,
    callToolsPlanToken: 0.3,
    agentResult: 1,
    // "LAZY_TOOLS_SCHEMA" || "FULL_TOOLS_SCHEMA"
    toolsMode: "LAZY_TOOLS_SCHEMA",
    // TOKEN || TURN
    compressionThresholdType: "TURN",
    compressionThresholdToken: 200,
    compressionThresholdTurnCount: 10,
    compressionTargetToken: 4,
    compressionKeepTurns: 2,
  }

  turns = []
  compressTurnIndexs = [
    // examples:
    // [1, 18]，
    // [19, 25]
  ]

  validateCompressionConfig() {
    const {
      compressionThresholdType,
      compressionThresholdTurnCount,
      compressionThresholdToken,
      compressionKeepTurns,
      compressionTargetToken,
    } = this.config

    if (!["TURN", "TOKEN"].includes(compressionThresholdType)) {
      throw new RangeError("compressionThresholdType 必须是 TURN 或 TOKEN")
    }
    if (!Number.isInteger(compressionKeepTurns) || compressionKeepTurns < 0) {
      throw new RangeError("compressionKeepTurns 必须是非负整数")
    }
    if (compressionThresholdType === "TURN" && (
      !Number.isInteger(compressionThresholdTurnCount) ||
      compressionThresholdTurnCount <= compressionKeepTurns
    )) {
      throw new RangeError("compressionThresholdTurnCount 必须是大于 compressionKeepTurns 的正整数")
    }
    if (compressionThresholdType === "TOKEN" && (
      !Number.isFinite(compressionThresholdToken) || compressionThresholdToken <= 0
    )) {
      throw new RangeError("compressionThresholdToken 必须是有限正数")
    }
    if (!Number.isFinite(compressionTargetToken) || compressionTargetToken < 0) {
      throw new RangeError("compressionTargetToken 必须是有限非负数")
    }
  }

  getContextSnapshot() {
    const uncompressedTurns = this.turns.filter((turn, index) => {
      return !this.compressTurnIndexs.some(
        ([start, end]) => index >= start && index <= end
      )
    })
    return {
      turns: uncompressedTurns.map(turn => {
        return {
          ...turn,
          actions: turn.actions.concat()
        }
      })
    }
  }
  doCompress() {
    const contextSnapshot = this.getContextSnapshot()
    const userTurns = contextSnapshot.turns.filter(turn =>
      turn.actions.some(action => action.group === "user_message")
    )
    const compressibleTurnCount = userTurns.length - this.config.compressionKeepTurns
    if (compressibleTurnCount <= 0) return

    // 快照中的 index 是原始 turns 下标，摘要 turn 不占用户轮次名额。
    const keptUserTurns = userTurns.slice(compressibleTurnCount)
    const compressionEnd = keptUserTurns.length > 0
      ? keptUserTurns[0].index - 1
      : contextSnapshot.turns[contextSnapshot.turns.length - 1].index
    const lastRange = this.compressTurnIndexs[this.compressTurnIndexs.length - 1]
    const compressionStart = lastRange ? lastRange[1] + 1 : 1
    this.compressTurnIndexs.push([compressionStart, compressionEnd])

    // 快照已生成，只影响压缩后请求的统计，不改变历史请求的分组。
    keptUserTurns.forEach(turn => {
      this.turns[turn.index].compressionKept = true
    })
    
    const turn = new Turn({index: this.turns.length, session: this})
    this.turns.push(turn)
    const llm = new LLMAction({
      input: contextSnapshot,
      output: new Action({ text: "compress history", token: this.config.compressionTargetToken, session: this }),
      session: this
    })
    // 设计上就是把compress llm放到保留的turn后面, 
    turn.actions.push(llm)
    turn.actions.push(llm.output)

  }


  reset() {
    this.validateCompressionConfig()
    this.turns = []
    this.actionIndex = 0
    this.compressTurnIndexs = []
    for(let i = 0; i < this.config.turnTotalCount; i++) {
      this.startNewTurn()
    }
  }
  
  getInitialContext() {
    return [
      this.initialContext.agentPrompt,
      this.initialContext.skillsDiscoverList,
      this.initialContext.toolsIndexList,
      ...[this.config.toolsMode === "FULL_TOOLS_SCHEMA"? this.initialContext.toolsSchemaList : undefined].filter(item => item),
      this.initialContext.roleAllowTools,
    ]
  }
  startNewTurn() {
    if (this.turns.length === 0) {
      const turn = new Turn({index: 0, session: this})
      this.turns.push(turn)
      turn.actions.push(...this.getInitialContext())
    }
    const turn = new Turn({index: this.turns.length, session: this})
    this.turns.push(turn)
    turn.runPlan()
  }
  getConsumptionTokens() {
    for (const key of ["inputCachedPrice", "inputNotCachedPrice", "outputPrice"]) {
      if (!Number.isFinite(this.config.model[key]) || this.config.model[key] < 0) {
        throw new RangeError(`请提供模型的 ${key}（非负有限单价）`)
      }
    }
    const llms = this.turns
      .map(turn => turn.actions)
      .flat()
      .filter(item => item.type === "llm")

    const totalInputCached = llms.reduce(
      (total, item) => total + item.cachedToken,
      0
    )

    const totalInputNotCached = llms.reduce(
      (total, item) => total + item.notCachedToken,
      0
    )

    const totalOutput = llms.reduce(
      (total, item) => total + item.output.token,
      0
    )

    // 按 action group 聚合所有 LLM 的 input token
    const actionGroupTokens = llms.reduce((result, llm) => {
      Object.entries(llm.actionGroupTokens || {}).forEach(
        ([group, tokens]) => {
          if (!result[group]) {
            result[group] = {
              cachedToken: 0,
              notCachedToken: 0
            }
          }

          result[group].cachedToken += tokens.cachedToken
          result[group].notCachedToken += tokens.notCachedToken
        }
      )

      return result
    }, {})

    const totalInputCachedPrice =
      (totalInputCached / 10 / 100) * this.config.model.inputCachedPrice

    const totalInputNotCachedPrice =
      (totalInputNotCached / 10 / 100) * this.config.model.inputNotCachedPrice

    const totalOutputPrice =
      (totalOutput / 10 / 100) * this.config.model.outputPrice

    const totalPrice =
      totalInputCachedPrice +
      totalInputNotCachedPrice +
      totalOutputPrice

    // 只统计实际用户消息轮次，初始上下文和压缩摘要不计入。
    const userTurnCount = this.turns.filter(turn =>
      turn.actions.some(action => action.group === "user_message")
    ).length
    const compressionCount = this.compressTurnIndexs.length
    const averageUserTurnsPerCompression = compressionCount === 0
      ? null
      : userTurnCount / compressionCount

    return {
      llms,
      averageUserTurnsPerCompression,

      totalInputCached,
      totalInputNotCached,
      totalOutput,

      actionGroupTokens,

      totalInputCachedPrice,
      totalInputNotCachedPrice,
      totalOutputPrice,
      totalPrice
    }
  }
  
  
}

// const lazyToolsSession = new Session({
//   toolsMode: "LAZY_TOOLS_SCHEMA",
//   // model: {
//   //   name: "gpt5.6-Luna",
//   // },
// })
// lazyToolsSession.reset()

// const fullToolsSession = new Session({
//   toolsMode: "FULL_TOOLS_SCHEMA",
//   // model: {
//   //   name: "gpt5.6-Luna",
//   // },
// })
// fullToolsSession.reset()
// console.log(
//   lazyToolsSession.getConsumptionTokens(),
//   fullToolsSession.getConsumptionTokens()
// )
export default Session
