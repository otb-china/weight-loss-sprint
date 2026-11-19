# 减重冲刺数据存储

IndexedDB 库名为 `weight-loss-sprint`，当前版本为 4。记录、照片和修订号在同一事务提交。

| 对象仓库及新键 | 旧键 | 内容 |
| --- | --- | --- |
| `recordsById` 内的记录 ID | 同一记录 ID | 饮食、体重、运动及回收站记录，有照片时只存 `photoId` |
| `photosById` 内的照片 ID | 记录内的 `photo` | JPEG Blob。新选照片最长边最多 2200 像素，迁移保留旧图的 JPEG 内容 |
| `photoThumbnailsById` 内的照片 ID | 无 | 最长边最多 320 像素的 JPEG 缩略图，可从照片重新生成 |
| `records / weight-loss-sprint:revision` | `records / revision` | 记录修订号 |
| `records / weight-loss-sprint:theme` | `records / theme` | 主题，首次从 weight-loss-sprint:theme 迁移 |
| `records / weight-loss-sprint:snapshot` | `records / snapshot` | 旧版数据库快照，现有记录迁移兼容入口 |

## 迁移与备份

升级在同一个数据库内复制旧元数据键，保留逐条记录。已存在的新键优先。旧版数据库快照优先于 `localStorage` 的 `weight-loss-sprint:records`。主题从旧键迁移一次。新版工具保存的数据以 IndexedDB 为准。迁移要求在原浏览器或 QuickOpen 的原 WebView 中打开同一站点。跨设备时使用工具页内的 JSON 导出与导入。

版本 4 使用游标逐条迁移旧的内嵌 JPEG，迁移中断时由 IndexedDB 回滚。照片 ID 沿用记录 ID。页面启动读取记录，列表按所选日期加载缩略图。旧照片在首次展示时生成缩略图，预览或识别才读取大图。移入回收站保留照片，彻底删除时一并清理。导出 JSON 时按旧格式写回 `photo` 字段并包含图片内容，用于跨设备恢复。

新版 QuickOpen 的整包备份（v4）包含本工具的 IndexedDB 数据，恢复到空库时可一并还原。目标已有不同记录时保留目标数据。旧版 QuickOpen 的 v3 备份只保存当时的 `localStorage`。 v4 包含原照片，缩略图会按需重建。

移除兼容前，需确认仍在用的旧版数据都有可用的迁移路径。保留 JSON 备份的导入兼容。
