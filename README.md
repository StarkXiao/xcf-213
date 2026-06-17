# 都市刑侦案件线索管理平台

一个现代化的案件线索管理系统，专为刑侦工作设计，支持案件台账、线索管理、人员关系分析、证据管理等核心功能。

## 技术栈

### 前端
- **React 18** + **TypeScript** - 类型安全的前端框架
- **Vite** - 快速的构建工具
- **Ant Design 5** - 企业级 UI 组件库
- **React Router** - 路由管理
- **Zustand** - 状态管理
- **ECharts** - 数据可视化（关系图谱）
- **Axios** - HTTP 客户端
- **Moment.js** - 日期处理

### 后端
- **Node.js** + **TypeScript** - 服务端运行环境
- **Fastify** - 高性能 Web 框架
- **Prisma** - 现代化 ORM
- **PostgreSQL** - 关系型数据库
- **@fastify/multipart** - 文件上传支持
- **@fastify/cors** - 跨域支持
- **@fastify/static** - 静态文件服务

## 功能模块

### 1. 案件台账
- 案件信息的录入、编辑、查询、删除
- 案件状态跟踪（已立案、侦查中、已结案等）
- 案件优先级管理（特急、紧急、高、中、低）
- 案件类型分类（刑事案件、经济案件、治安案件等）
- 关联人员、线索、证据的统一管理

### 2. 线索录入
- 线索信息的完整记录和管理
- 线索类型分类（人证线索、物证线索、视频监控等）
- 线索可信度和重要性评估
- 线索与案件、人员的关联
- 线索状态跟踪（待核实、核实中、已核实、已采用等）

### 3. 人员关系图
- 人员信息的完整档案管理
- 基于 ECharts 的力导向关系图谱可视化
- 动态展示人员之间的关系网络
- 支持查看单个人员的关系子网
- 支持添加和管理人员关系

### 4. 证据附件
- 多种格式证据文件上传（图片、视频、音频、文档等）
- 证据类型分类（物证、书证、证人证言、鉴定意见等）
- 证据在线预览（图片、视频、音频）
- 证据与案件、线索的关联管理
- 证据收集信息完整记录

### 5. 查询筛选
- 跨模块多条件组合查询
- 支持按案件、线索、人员、证据分类查看结果
- 支持时间范围、地点、人员等多维度筛选
- 查询结果可直接跳转详情页

### 6. 后台接口
- RESTful API 设计规范
- 完整的 CRUD 操作接口
- 文件上传和下载接口
- 高级搜索接口
- 统一的数据格式和错误处理

## 项目结构

```
xcf-213/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── components/        # 公共组件
│   │   ├── layouts/           # 布局组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── cases/         # 案件管理模块
│   │   │   ├── clues/         # 线索管理模块
│   │   │   ├── persons/       # 人员管理模块
│   │   │   ├── relations/     # 关系图模块
│   │   │   ├── evidences/     # 证据管理模块
│   │   │   └── search/        # 高级查询模块
│   │   ├── services/          # API 服务
│   │   ├── store/             # 状态管理
│   │   ├── types/             # TypeScript 类型定义
│   │   ├── App.tsx            # 应用入口
│   │   ├── main.tsx           # 渲染入口
│   │   └── index.css          # 全局样式
│   ├── .env                   # 环境配置
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                    # 后端项目
│   ├── prisma/
│   │   ├── schema.prisma      # 数据库模型
│   │   └── seed.ts            # 演示数据脚本
│   ├── src/
│   │   ├── routes/            # API 路由
│   │   │   ├── cases.ts
│   │   │   ├── clues.ts
│   │   │   ├── persons.ts
│   │   │   ├── evidences.ts
│   │   │   └── search.ts
│   │   └── index.ts           # 服务入口
│   ├── uploads/               # 上传文件目录
│   ├── .env                   # 环境配置
│   ├── package.json
│   └── tsconfig.json
├── package.json               # 根项目配置
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### 1. 数据库准备

首先确保 PostgreSQL 已安装并运行，创建数据库：

```sql
CREATE DATABASE criminal_investigation;
```

### 2. 安装依赖

在项目根目录执行：

```bash
npm run install:all
```

这将同时安装根目录、后端和前端的所有依赖。

### 3. 配置环境变量

**后端配置** (`server/.env`)：
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/criminal_investigation?schema=public"
PORT=3001
UPLOAD_DIR="./uploads"
```

**前端配置** (`client/.env`)：
```
VITE_API_URL=http://localhost:3001
VITE_APP_TITLE=案件线索管理平台
```

> 注意：请根据实际情况修改数据库连接信息。

### 4. 初始化数据库

```bash
npm run db:setup
```

这将执行以下操作：
- 运行数据库迁移，创建数据表
- 生成 Prisma Client
- 插入演示数据

### 5. 启动服务

**启动后端服务**（终端 1）：
```bash
npm run dev:server
```

后端服务将在 http://localhost:3001 启动

**启动前端服务**（终端 2）：
```bash
npm run dev:client
```

前端服务将在 http://localhost:5173 启动

### 6. 访问系统

打开浏览器访问 http://localhost:5173 即可使用系统。

## 演示数据说明

系统初始化后将自动创建以下演示数据：

### 案件（2件）
1. **科技公司CEO办公室死亡案** - 刑事案件，侦查中
2. **公司财务数据造假案** - 经济案件，侦查中

### 人员（6人）
- 张伟强（受害人）- 科技公司CEO
- 李明辉（嫌疑人）- 技术总监
- 王美玲（嫌疑人）- 财务经理
- 赵小龙（证人）- 保安
- 陈雪芳（证人）- 秘书
- 刘建国（关系人）- 投资人

### 线索（5条）
- 保安目击可疑人员
- 监控视频记录
- 财务异常记录
- 秘书最后接触记录
- 匿名举报信

### 证据（5份）
- 18层走廊监控录像
- 案发现场照片
- 财务报表及银行流水
- 证人询问笔录
- 举报材料原件

## 演示流程

### 流程一：案件录入
1. 点击左侧菜单「案件台账」
2. 点击右上角「新增案件」按钮
3. 填写案件信息（案件标题、类型、描述、地点等）
4. 点击「创建案件」提交
5. 在案件列表中点击新创建的案件查看详情

### 流程二：线索关联
1. 点击左侧菜单「线索录入」
2. 点击右上角「新增线索」按钮
3. 选择关联案件，填写线索信息
4. 在「关联人员」标签页选择相关人员
5. 提交后可在案件详情页看到关联的线索

### 流程三：证据管理
1. 点击左侧菜单「证据附件」
2. 点击右上角「上传证据」按钮
3. 选择证据文件，填写证据信息
4. 可选择关联的案件和线索
5. 提交后可在证据列表预览和下载证据
6. 在案件详情页的「证据」标签页查看关联证据

### 流程四：关系图分析
1. 点击左侧菜单「人员关系图」
2. 系统默认展示全部人员关系网络
3. 可在搜索框选择特定人员查看其关系子网
4. 点击图中节点可查看人员详情
5. 点击「添加关系」按钮可创建新的人员关系

### 流程五：高级查询
1. 点击左侧菜单「查询筛选」
2. 展开各分类面板设置查询条件
3. 点击「开始搜索」按钮
4. 在结果页按分类标签查看匹配结果
5. 点击记录可跳转至详情页

## API 接口

### 案件接口
- `GET /api/cases` - 获取案件列表
- `GET /api/cases/:id` - 获取案件详情
- `POST /api/cases` - 创建案件
- `PUT /api/cases/:id` - 更新案件
- `DELETE /api/cases/:id` - 删除案件
- `GET /api/cases/:id/stats` - 获取案件统计数据

### 线索接口
- `GET /api/clues` - 获取线索列表
- `GET /api/clues/:id` - 获取线索详情
- `POST /api/clues` - 创建线索
- `PUT /api/clues/:id` - 更新线索
- `DELETE /api/clues/:id` - 删除线索
- `POST /api/clues/:id/persons` - 关联人员
- `DELETE /api/clues/:id/persons/:personId` - 解除人员关联

### 人员接口
- `GET /api/persons` - 获取人员列表
- `GET /api/persons/:id` - 获取人员详情
- `POST /api/persons` - 创建人员
- `PUT /api/persons/:id` - 更新人员
- `DELETE /api/persons/:id` - 删除人员
- `GET /api/persons/:id/relations` - 获取人员关系
- `POST /api/persons/:id/relations` - 添加人员关系
- `GET /api/persons/relations/all` - 获取全部关系图

### 证据接口
- `GET /api/evidences` - 获取证据列表
- `GET /api/evidences/:id` - 获取证据详情
- `POST /api/evidences/upload` - 上传证据
- `DELETE /api/evidences/:id` - 删除证据
- `GET /api/evidences/cases` - 获取可选案件列表
- `GET /api/evidences/cases/:caseId/clues` - 获取案件下的线索

### 查询接口
- `GET /api/search/options` - 获取枚举选项
- `GET /api/search/advanced` - 高级搜索

## 开发说明

### 数据库模型更新
修改 `server/prisma/schema.prisma` 后执行：
```bash
cd server
npm run prisma:migrate
npm run prisma:generate
```

### 重置演示数据
```bash
cd server
npm run prisma:seed
```

### 生产构建
```bash
# 后端构建
cd server
npm run build
npm start

# 前端构建
cd client
npm run build
npm run preview
```

## 注意事项

1. **文件上传**：上传的文件默认保存在 `server/uploads` 目录，请确保该目录存在且有写入权限
2. **数据库连接**：请根据实际 PostgreSQL 配置修改 `.env` 文件中的连接字符串
3. **CORS**：后端默认允许所有来源的跨域请求，生产环境请按需调整
4. **演示数据**：每次执行 `prisma db seed` 都会先清空现有数据再重新插入
5. **端口占用**：确保 3001（后端）和 5173（前端）端口未被占用

## 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## License

MIT
