# WebGL VI

基于 Vue 3 + Vite 的地图可视化项目：Cesium 负责天地图底图与边界，three.js 负责立体板块与天气特效，上传页负责登记并回显自己的边界数据。

## 一、环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | `>= 20.19`（见 `package.json` 的 `engines`） |
| 包管理器 | npm（仓库提供 `package-lock.json`） |
| 浏览器 | 支持 WebGL2 的现代浏览器（Chrome / Edge / Safari），建议开启硬件加速 |
| 网络 | 访问天地图瓦片服务需要公网，且 key 有效、域名白名单匹配 |

主要依赖：`vue` 3.5、`vite` 6、`pinia` 2、`vue-router` 4、`cesium` 1.126、`three` 0.172、`sass`。

## 二、如何启动

```bash
npm install
npm run dev
```

打开终端输出的地址（默认 `http://localhost:5173`）。

页面入口：

| 路径 | 内容 |
| --- | --- |
| `/` | 主页、状态总览与设计说明 |
| `/cesium` | 天地图底图 + demo边界 + 设备图标渲染方式切换 + 首屏万级点位分帧加载测试 |
| `/three` | demo立体板块 + 光效 / 天气控制器 |
| `/upload` | 上传边界文件、回显边界、配置中心点与相机焦距 |

生产构建与本地预览：

```bash
npm run build
npm run preview
```

## 三、天地图 Key 放在哪里

`src/config/map.js` 是唯一配置入口，按以下优先级读取（前者优先）：

1. 项目根目录 `.env.local` 中的 `VITE_TIANDITU_KEY`
2. `src/config/map.local.js` 中的 `TIANDITU_KEY`

两种方式选其一即可；同时存在时以 `.env.local` 为准。

### 方式一：`.env.local`（推荐）

仓库提供了 `.env.example` 模板，复制后替换占位值：

```bash
cp .env.example .env.local
```

`.env.local` 内容：

```dotenv
VITE_TIANDITU_KEY=你的天地图key
# 可选：自定义服务域名，{s} 会由 Cesium 替换为 0-7 子域
VITE_TIANDITU_HOST=https://t{s}.tianditu.gov.cn
```

注意：Vite 只注入 `VITE_` 前缀的变量；值不要加引号，也不要留多余空格。

### 方式二：`src/config/map.local.js`

```js
export const TIANDITU_KEY = '你的天地图key'
```

### 生效与忽略规则

- 修改任意一种配置后需要**重启开发服务器**：Vite 在启动时读取环境变量和 `import.meta.glob` 引入的本地模块。
- `.gitignore` 已忽略 `.env.local`、`.env.*.local` 与 `/src/config/*.local.js`，这两个文件都不要提交到仓库。
- `.gitignore` 只对「未被 Git 跟踪」的文件生效。如果本地文件已经被跟踪，需要先从索引移除（保留本地文件）再提交：

  ```bash
  git rm --cached src/config/map.local.js
  git add .gitignore
  git commit -m "chore: 忽略本地天地图 key 配置文件"
  ```

### 未配置 key 时的表现

`tianditu.ready` 为 `false`，代码不会发起瓦片请求；页面提示「缺少 key」，地图背景为纯色。边界、立体板块、天气特效、设备图标等不依赖底图的功能仍可正常使用。

### 底图不显示的排查顺序

1. 确认 key 已填写、无多余引号或空格，并且重启了 dev server。
2. 打开浏览器控制台查看天地图 WMTS 请求，常见为 `401 / 403`：key 无效、key 类型不匹配，或域名白名单未包含 `localhost`。
3. 确认网络可访问 `https://t{s}.tianditu.gov.cn`。
4. 在 `/cesium` 或 `/upload` 左上角的底图面板点「重新加载」，或切换「矢量底图」验证是否为单个图层的问题。

## 四、其它说明

- 默认边界数据为 `statics/demo1.json`；设备图标位于 `statics/icon/`，雪花贴图为 `statics/weather/snow.png`。
- Cesium 的运行时静态资源由 `vite-plugin-static-copy` 从 `node_modules/cesium/Build/Cesium` 拷贝到 `dist/cesium`，`CESIUM_BASE_URL` 为 `/cesium/`；构建后若 Cesium 报资源 404，先检查该目录是否生成。
- 上传页支持 shp / GeoJSON 等边界文件；投影坐标目前只做提示，不会自动转换到 WGS84。
- 若 key 曾随文件被提交进历史，仅移除索引无法清除历史记录，建议到天地图平台轮换该 key。
