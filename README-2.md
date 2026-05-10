<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🎨 无限画布 - AI 创意工作台

**一站式 AI 图像 & 视频生成工作流平台**

</div>

---

## ⚠️ 重要警告 - 请务必阅读

> **博主郑重提醒：自接 API 平台存在较大风险！**

### 🚨 风险警示

很多小型 API 中转商/平台可能会：
- ❌ **跑路风险**：充值后平台消失，血本无归
- ❌ **服务不稳定**：经常宕机、接口报错
- ❌ **数据安全**：你的 API Key 和生成内容可能被泄露
- ❌ **无售后**：出问题找不到人

### ✅ 推荐方案

如果你的**出图量和出视频量较大**，强烈建议使用正规大厂服务：

| 推荐平台 | 官网 | 价格优势 |
|---------|------|---------|
| **献丑AI** | [xianchou.com](https://xianchou.com) | Banana Pro 4K 仅 **0.2元/张**，Sora 2 顶配参数仅 **4积分/条** |

> 💡 大厂服务稳定、有保障、不跑路，长期使用更划算！

---

## ⚙️ 关于接口兼容性说明

> **重要提示：不同 API 中转商的接口参数格式可能不同！**

本项目默认适配了 [New API](https://docs.newapi.pro) 标准格式，但由于各家 API 服务商的实现差异：

- 📌 请求参数名称可能不同（如 `image` vs `image_url` vs `src_image`）
- 📌 响应格式可能不同（如 `task_id` vs `id` vs `request_id`）
- 📌 端点路径可能不同（如 `/v1/video/generations` vs `/v1/video/create`）

**如果你使用的 API 服务商接口不兼容**，可能需要：

1. 查阅你的 API 服务商文档
2. 使用 AI 编辑器（如 Cursor、Windsurf）修改 `services/mode/` 目录下的相关代码
3. 或者在 Issues 中反馈，我会尽量适配

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm / npm / yarn

### 安装运行

```bash
# 安装依赖
npm install
# 或
pnpm install

# 启动开发服务器
npm run dev
```

### 配置 API

1. 点击左侧菜单的 ⚙️ 设置图标
2. 配置全局或单个模型的 API Key 和 Base URL
3. 开始创作！

---

## 📁 项目结构

```
├── App.tsx                 # 主应用
├── components/
│   ├── Canvas.tsx          # 画布组件
│   ├── Sidebar.tsx         # 侧边栏
│   ├── Nodes/              # 节点组件
│   └── Settings/           # 设置相关
├── services/
│   ├── mode/               # 模型配置和 API 调用
│   │   ├── config.ts       # 模型注册表
│   │   ├── image/          # 图像生成
│   │   └── video/          # 视频生成
│   └── geminiService.ts    # 服务入口
└── types.ts                # 类型定义
```

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

---

## 📄 License

MIT License

