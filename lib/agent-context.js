/** 服务端：将客户端传来的 Canvas 上下文拼入 coach 用户消息 */

/**
 * @param {string} userContent
 * @param {string} [canvasContext]
 * @param {string} [crossMemory]
 */
export function appendAgentContextToUserMessage(userContent, canvasContext, crossMemory) {
  const blocks = [];
  if (crossMemory && String(crossMemory).trim()) {
    blocks.push(`## 跨场景记忆（其他模块近期结论）\n${String(crossMemory).trim()}`);
  }
  if (canvasContext && String(canvasContext).trim()) {
    blocks.push(`## 当前 Canvas 上下文\n${String(canvasContext).trim()}`);
  }
  blocks.push(userContent);
  return blocks.join('\n\n');
}
