# Prompt Manager 项目技术说明

## 项目愿景与核心理念
- 目标：构建一个面向 Prompt Engineer 的高速、极简、键盘友好的提示语管理工具。
- 核心体验：通过“Focus Mode”在浏览与专注之间平滑切换，选定提示语后仅保留内容视图，减少干扰。
- 用户场景：快速检索、创建、编辑和分享高质量提示语，支持规模化的个人知识库管理。

## 技术栈与运行环境
- 后端：Python 3.12+、Flask 3、Flask-SQLAlchemy、SQLite；通过 SQLAlchemy 2.0 风格 ORM 建模。
- 前端：原生 HTML5、CSS3（Flexbox 布局）、ES6+ 原生 JavaScript，强调轻量与即时反馈。
- 测试：pytest，覆盖模型关系、API CRUD、搜索与错误处理。
- 部署：Gunicorn（`Procfile`），默认配置通过 `config.Config` 提供；支持环境变量 `DATABASE_URL`、`SECRET_KEY` 覆盖。

## 代码结构总览
```text
prompt_manager/
├── app/
│   ├── __init__.py        # Flask 工厂、错误处理与 shell 上下文
│   ├── models.py          # Domain/Subtopic/Prompt ORM 模型
│   ├── routes.py          # API 与前端路由蓝图
│   ├── templates/index.html
│   └── static/{css,js}    # 样式与交互脚本
├── tests/                 # pytest 测试套件
├── seed.py                # 数据填充脚本
├── run.py                 # 开发服务器入口
├── config.py              # 配置对象
├── Procfile               # Gunicorn 启动声明
├── requirements.txt
└── README.md
```

## 数据模型
| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `Domain` | `id`, `name` (唯一) | 顶层主题；与 Subtopic 一对多，删除时级联清理下级实体。|
| `Subtopic` | `id`, `name`, `domain_id` | 二级主题；与 Prompt 一对多，提供层级导航。|
| `Prompt` | `id`, `title`, `content`, `subtopic_id`, `is_template`, `configurable_options` | 最终提示语实体。`is_template` 标记其为模板，`configurable_options` (JSON) 存储动态选项。|
| `PromptImage` | `id`, `prompt_id`, `filename`, `sort_order` | 多图附件元数据；图片随 Prompt 级联删除，并按上传顺序展示。|

- 关系策略：`selectinload` 预加载层级，减少 N+1 查询。外键完整性保证数据一致。
- `models.py` 使用类型注解与 `mapped_column` 强化可读性。

## 核心 API 设计 (`app/routes.py`)
| 路径 | 方法 | 功能 | 返回 |
| --- | --- | --- | --- |
| `/api/structure` | GET | 返回 Domain → Subtopic → Prompt 的完整层级 | 列表，每个 prompt 仅携带 `id` 与 `title` |
| `/api/subtopics` | GET | 列出全部 Subtopic 及 Domain 元数据 | Subtopic 列表 |
| `/api/prompts/<id>` | GET | 获取单个 Prompt 内容 | `title`、`content` |
| `/api/prompts` | POST | 创建 Prompt，校验标题/内容/子主题 | 新建 Prompt 元数据 |
| `/api/prompts/<id>` | PUT | 更新 Prompt，包含字段验证与存在性检查 | 更新后的 Prompt 元数据 |
| `/api/prompts/<id>` | DELETE | 删除 Prompt 并返回 204 | 空响应 |
| `/api/search?q=keyword` | GET | 标题或内容模糊搜索（大小写不敏感） | 匹配 Prompt 列表 |

- API 采用 Blueprint 隔离，统一 JSON 错误处理。
- 搜索端点使用 `func.lower` 与 `like` 实现轻量关键字匹配，支持实时前端体验。

## 前端交互与 Focus Mode (`app/templates/index.html`, `app/static/js/app.js`)
- 双面板布局：左侧导航展示三级层级与搜索结果，右侧详情区承载“专注”视图。
- 交互逻辑：原生 JS 管理状态、复制反馈、搜索防抖（300ms）、模态对话框控制与表单校验。
- 创建/编辑：复用同一模态组件，通过 `modalMode` 区分流程；成功后瞬时更新导航与详情。
- 删除：确认流程与状态重置，确保 UI 与数据一致。
- 搜索：输入时切换导航/结果容器，提供加载、空结果与错误提示文案。

## 数据填充与开发辅助
- `seed.py`：清空数据库、批量插入双语示例数据，便于演示 Focus Mode 与搜索体验。
- 运行方式：
  ```bash
  python seed.py
  ```
  在脚本内调用 `create_app()` 并在应用上下文中执行事务。

## 数据库备份
项目包含一个用于创建数据库时间点快照的备份脚本。

- **核心脚本**: `backup.py`
- **执行方式**: 在 Windows 环境下，直接运行 `run_backup.bat`。在其他环境或手动执行时，运行 `python backup.py`。
- **备份源**: 脚本会备份位于项目根目录的 `prompt_manager.db` 文件。
- **备份目标**: 备份文件存储在 `backup_db/` 目录下。
- **命名格式**: 备份文件以 `YYYY-MM-DD_HH_MM_SS_prompt_manager.db` 的格式命名，确保每个备份都是唯一的。

## 测试策略 (`tests/`)
- `tests/test_models.py`：验证 ORM 关系与唯一性约束，确保级联与数据完整性。
- `tests/test_api.py`：覆盖结构、详情、创建、更新、删除、搜索等核心 API 行为与错误分支。
- 运行命令：
  ```bash
  pytest
  ```
  测试采用内存 SQLite，保持快速可重复执行。

## 本地运行与配置
1. 建议使用虚拟环境，并命名为 `env_pm` 放置在项目根目录：`python -m venv env_pm && .\env_pm\Scripts\activate` (Windows)。
2. 安装依赖：`pip install -r requirements.txt`。
3. 初始化数据库：
   ```bash
   flask --app run.py shell -c "from app import db; db.create_all()"
   ```
   或执行 `python seed.py` 生成示例数据。
4. 启动开发服务器：`python run.py`，默认监听 `http://127.0.0.1:5000/`。
5. 生产部署可直接使用 `gunicorn "app:create_app()"`（由 `Procfile` 驱动）。

## 部署与运维要点
- 使用环境变量 `DATABASE_URL` 切换至生产数据库（如 PostgreSQL）。
- 通过 `Flask-Migrate`/Alembic 维护数据库迁移。使用 `flask db upgrade` 更新结构。
- 监控：依赖 Flask 日志记录 API 异常，可对接外部日志或 APM。
- 静态资源轻量，可复用 CDN 或反向代理缓存。

## 图片上传与展示
- Prompt 详情 API (`/api/prompts/<id>`) 返回 `images` 数组（id、filename、url），前端在正文下方生成响应式画廊。
- 创建/更新接口支持 `multipart/form-data`（字段同 JSON），图片字段 `images` 可多选；兼容现有 JSON 请求。
- 默认上传目录：`app/static/uploads`（可通过 `UPLOAD_FOLDER` 配置覆盖），文件通过 `/uploads/<filename>` 路由访问。
- 约束：仅允许 png/jpg/jpeg/gif/webp，单 Prompt 最多 8 张；删除 Prompt 时自动移除关联图片及文件。

## 后续增强建议
- 引入标签/收藏等个性化元数据以支持更复杂检索维度。
- 集成全文搜索（如 SQLite FTS 或外部搜索服务）提升大规模数据查询表现。
- 为前端添加快捷键导航与离线缓存支持，进一步强化 Focus Mode 体验。
- 将当前的手动 seed 流程拓展为命令行工具（Flask CLI 命令）以便脚本化运维。

