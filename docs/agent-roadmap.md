# MindTraining Agent 路线图

## 当前默认路径（无需 Serper）

| 能力 | 说明 |
|------|------|
| 内置题库 + 知识库 RAG | 原有 `knowledge.json` + 场景 JSON |
| LLM 仿真出题 | 按目标/岗位生成【AI生成·…】或【RAG面经·…】题干 |
| **人工投喂面经 RAG** | 编辑根目录 `interview-rag-feed.json`，部署后自动注入会话 RAG |

### 投喂格式示例

```json
{
  "version": 1,
  "posts": [
    {
      "title": "字节产品一面 · 推荐策略",
      "body": "面试官问：如果推荐 feed 点击率涨但时长降，你怎么判断…",
      "sourceLabel": "整理面经",
      "url": "https://example.com/optional",
      "tags": ["字节", "产品经理", "推荐"]
    }
  ]
}
```

`tags` / 标题 / 正文中的关键词会用于匹配「明天面字节产品」这类目标。

## 可选：自动检索（暂不配置亦可）

配置 `SERPER_API_KEY` 后，面试目标会自动检索牛客/小红书摘要并 merge 进 `ragChunks`。  
**不配置不影响使用**——用内置题库 + AI 出题 + 后续手动投喂即可。

## 后续改进

- 投喂面经持久化缓存（Redis）
- 粘贴牛客链接抓全文（Firecrawl）
- 向量检索
