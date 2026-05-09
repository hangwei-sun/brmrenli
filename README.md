# 包融媒人力智慧管理系统

**包头市融媒体中心** — 手写请假条OCR识别与数字化人力管理

基于 Electron + Vue 3 + Element Plus 的桌面应用程序，集成多种AI识别引擎，支持手写请假条智能识别、数据管理、查询筛选、统计报表和员工生日祝福。

开发部门：数智化发展部

## 功能特性

### 1. 多引擎OCR识别
- **GLM-OCR**（智谱AI专用OCR模型）— layout_parsing API，高精度文字检测与识别
- **GLM-4.6V**（智谱AI视觉大模型）— 手写体识别率约90-98%，自动忽略印刷体，需联网
- **腾讯云OCR** — 手写体专用API，高精度，需配置密钥
- **Tesseract**（本地）— 离线可用，免费无限制
- 智能提取：申请人、部门、代办人、请假类型、日期、天数等字段
- 空间位置分析 + 大模型语义理解，精准分离印刷体与手写内容
- 识别结果预览与手动修正

### 2. 手动录入
- 无法识别的图片可手动填写表单
- 支持上传请假条图片（自动保存至应用目录，可在数据管理中查看原图）
- 完整字段录入：申请日期、申请人、部门、代办人、请假类型、起止日期、天数、销假日期、备注
- 手动录入数据同样纳入数据库统一管理

### 3. 数据管理
- 请假记录增删改查
- 支持单条/批量删除
- 点击查看原始请假条图片（含手动录入上传的图片）
- 导出全部数据到Excel
- 从Excel批量导入历史数据

### 4. 查询筛选
- 按申请人姓名模糊搜索
- 按部门筛选
- 按请假类型筛选
- 按时间范围筛选（开始/结束日期）
- 组合条件查询
- 查询结果导出Excel

### 5. 统计报表
- 概览卡片：总记录数、部门数、请假人次、请假类型数
- 年份切换筛选（自动加载数据库中的可用年份）
- 请假类型占比饼图
- 各部门请假人次柱状图
- 年度月度趋势折线图（含月均参考线）
- 人员请假排行榜TOP 10（前三名高亮）
- 所有图表支持导出为PNG图片

### 6. 生日祝福
- 员工花名册管理（姓名、电话、身份证号、部门）
- 批量Excel导入/手动录入员工信息
- 身份证号自动提取出生日期
- 按单月/时间段筛选生日员工
- 本月生日员工清单展示
- 生日清单导出Excel
- 隐私模式：开启后电话和身份证号部分脱敏显示（138****1234 / 1101**********1234）

### 7. 系统设置
- OCR引擎切换（GLM-OCR / GLM-4.6V / 腾讯云 / Tesseract）
- GLM API密钥配置与连接测试
- 腾讯云API密钥配置与连接测试
- 浅色/暗色/跟随系统主题切换
- 识别自动保存开关
- 隐私模式开关

## 技术栈

| 技术 | 用途 |
|------|------|
| Electron 33 | 桌面应用框架 |
| Vue 3 (Composition API) | 前端框架 |
| Element Plus | UI组件库 |
| ECharts 5 | 统计图表 |
| sql.js | SQLite数据库（WebAssembly，无需编译） |
| Tesseract.js 5 | 本地OCR引擎 |
| GLM-OCR / GLM-4.6V-Flash | 智谱AI识别引擎 |
| tencentcloud-sdk-nodejs-ocr | 腾讯云OCR引擎 |
| sharp | 图像预处理 |
| xlsx | Excel导入导出 |
| Vite 6 | 构建工具 |
| electron-builder | 打包分发 |

## 安装与运行

### 前置要求

- Node.js >= 18
- npm >= 9
- Windows 10/11

### 安装依赖

```bash
cd leave-management
npm install
```

> **注意**：`sharp` 和 `tesseract.js` 需要原生模块支持。Windows 用户请确保已安装：
> - [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)（含 C++ 桌面开发工作负载）
> - Python 3.x

### 开发模式运行

```bash
# 仅启动Vue前端（浏览器中预览UI）
npm run dev

# 启动Electron + Vite（完整桌面应用）
npm run electron:dev
```

首次运行时会自动：
1. 下载 Tesseract.js 中文简体语言包（chi_sim）
2. 在用户数据目录创建 SQLite 数据库
3. 创建 `images/` 目录用于备份上传的图片

### 生产构建

```bash
# 构建Vue前端
npm run build

# 打包Windows安装程序（NSIS）
npm run electron:build:win

# 打包当前平台
npm run electron:build
```

打包后的安装程序位于 `release/` 目录。

**构建提示**：如遇到签名错误，可执行：
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --publish=never --config.win.signAndEditExecutable=false
```

## 项目结构

```
leave-management/
├── package.json                 # 项目配置与依赖
├── vite.config.js               # Vite构建配置
├── index.html                   # HTML入口
├── build/
│   └── icon.ico                 # 应用图标（安装程序用）
├── public/
│   └── logo.png                 # 应用Logo（标题栏显示）
├── electron/
│   ├── main.js                  # Electron主进程（窗口管理、IPC通信）
│   ├── preload.js               # 预加载脚本（安全暴露API）
│   ├── database.js              # SQLite数据库操作（sql.js，参数化查询）
│   ├── ocr.js                   # 多引擎OCR封装（Tesseract/腾讯云/GLM-4.6V/GLM-OCR）
│   ├── settings.js              # JSON文件设置持久化
│   └── icon.ico                 # 窗口图标
├── src/
│   ├── main.js                  # Vue应用入口
│   ├── App.vue                  # 主布局（标签页切换、主题、引擎标签）
│   ├── components/
│   │   ├── ImageUpload.vue      # 图片上传与OCR识别（含手动录入）
│   │   ├── OcrPreview.vue       # OCR结果预览修正
│   │   ├── DataTable.vue        # 数据表格与批量操作
│   │   ├── SearchPanel.vue      # 组合条件查询筛选
│   │   ├── Statistics.vue       # 统计图表（年度筛选、TOP10）
│   │   ├── BirthdayBlessing.vue # 生日祝福（员工管理、隐私脱敏、Excel导入导出）
│   │   └── SettingsDialog.vue   # 系统设置对话框
│   └── utils/
│       └── api.js               # Electron API安全封装层
├── scripts/
│   └── png-to-ico.js            # PNG转ICO工具脚本
└── README.md
```

## 数据库表结构

```sql
-- 请假记录表
CREATE TABLE leave_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant       TEXT NOT NULL,     -- 申请人
    department      TEXT,              -- 部门
    agent           TEXT,              -- 代办人
    leave_type      TEXT NOT NULL,     -- 请假类型
    start_date      DATE NOT NULL,     -- 开始日期
    end_date        DATE NOT NULL,     -- 结束日期
    days            INTEGER NOT NULL,  -- 天数
    apply_date      DATE,              -- 申请日期
    cancel_date     DATE,              -- 销假日期
    image_path      TEXT,              -- 原图片路径
    ocr_confidence  REAL,              -- OCR置信度
    remark          TEXT,              -- 备注
    created_at      DATETIME DEFAULT (datetime('now','localtime'))
);

-- 员工信息表
CREATE TABLE employees (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,     -- 姓名
    phone           TEXT,              -- 电话
    id_number       TEXT NOT NULL UNIQUE, -- 身份证号（唯一）
    department      TEXT,              -- 所在部门
    created_at      DATETIME DEFAULT (datetime('now','localtime'))
);
```

数据库文件自动创建在 Electron 用户数据目录（`%APPDATA%/leave-management/leave_records.db`）。

## 支持的请假类型

年休假、病假、事假、婚假、丧假、探亲假、产假、护理假、育儿假

## 注意事项

1. **首次启动**会下载 Tesseract 中文语言包（约10MB），请保持网络连接
2. **GLM-OCR / GLM-4.6V / 腾讯云OCR** 需在设置中配置 API Key 后方可使用
3. 上传的请假条图片会自动备份到应用数据目录的 `images/` 文件夹
4. 手动录入时上传的图片通过base64写入应用目录，可在数据管理中查看原图
5. 所有数据库操作使用参数化查询，防止SQL注入
6. 识别结果建议人工复核后再保存，手动录入数据置信度为100
7. 设置保存在 `%APPDATA%/leave-management/settings.json`

## 版本历史

- **v1.6.0** — GLM-OCR引擎接入、手动录入申请日期置顶+识图上传、生日清单Excel导出
- **v1.5.0** — Logo全面替换、OCR预览布局优化、手动录入优化、版本号与打包同步
- **v1.4.0** — GLM-OCR集成（layout_parsing API）
- **v1.3.0** — 生日祝福模块（员工花名册、Excel批量导入、生日筛选、隐私模式）
- **v1.2.0** — 应用更名、GLM-4.6V大模型对接、自定义Logo、开发部门信息
- **v1.1.0** — 年度统计趋势图、人员TOP10排行榜、年份筛选
- **v1.0.1** — 腾讯云OCR、暗色模式、手动录入、版权信息、印刷体过滤
- **v1.0.0** — 初始版本

## 许可证

内部使用项目 — 包头市融媒体中心
