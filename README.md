# 墨台 · 内容管理工作台

一个带前端、后端、身份认证与数据持久化的内容管理网站。

## 功能

- 使用 ChatGPT 账号登录
- 新建、编辑、删除内容
- 草稿与发布状态管理
- 管理员查看全站内容和成员
- 管理员调整成员角色
- 首位登录用户自动成为管理员

## 本地开发

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

生成数据库迁移并构建：

```bash
npm run db:generate
npm run build
```

数据使用 Cloudflare D1 存储，部署配置位于 `.openai/hosting.json`。
