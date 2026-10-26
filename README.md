# 归寝 · 食工261

网页文件位于仓库根目录，完整源代码在 source/。

在 Settings → Pages 中选择 Deploy from a branch，分支 main，目录 / (root)，保存后访问：
https://yp0067.github.io/dorm-check/

已配置 Supabase 共享数据库；config.json 只有公开地址和公开密钥，不含后台管理密钥。
寝室长选择在寝/未归；未填写显示未登记；班长查看三列核对；副班核对时间、原因并填写补充备注。

姓名入口不验证本人身份，知道姓名的人可以选择对应角色。请仅在可信班级范围内使用。

修改界面后，在 source 目录运行 npm ci、npm test、npm run build，再将 source/dist 的内容更新到仓库根目录。
修改后台需重新发布 source/supabase/functions/night；线上允许来源默认为 https://yp0067.github.io，可通过 ALLOWED_ORIGIN 覆盖。
