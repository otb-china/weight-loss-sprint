# weight-loss-sprint

减肥冲刺！！！一个按天记录饮食、体重和运动时长的网页。

- 饮食记录当天吃了什么，可补充份量和备注。
- 体重以公斤记录，运动时长以分钟记录。
- 可按日期查看、补录和编辑。数据保存在当前浏览器，可通过设置导出或合并导入 JSON 备份。
- 移除的记录会在回收站保留七天。

## 本地开发

```bash
pnpm install
pnpm dev
npx vue-tsc --noEmit -p tsconfig.app.json
```

推送到 `master` 后，GitHub Actions 自动构建并部署到 GitHub Pages。
