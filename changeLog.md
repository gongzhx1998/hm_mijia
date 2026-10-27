# 20261024

## 第4次修改

<!-- changelog-id: e2216734a882dfbf -->

1、修改了什么需求

家庭定位自动切换、设备官方排序与图标、净水器数据及标准插件动画支持

2、完成情况

- 家庭自动切换与位置权限：新增 GET_WIFI_INFO 及位置权限申请，支持按当前连接 Wi-Fi 路由器 BSSID 与经纬度距离自动匹配切换家庭
- 设备排序与真实产品图标：接入 /v2/home/get_union_order 与 gethome_merged 房间顺序对齐米家官方固定排序；接入 /v2/productconfig/single_pull 渲染真实产品透明 PNG 图标并持久化缓存
- 插件数据与桥接修复：修复 MIOTDevice/MIOTService/MIOTSpec 回调签名与隐私授权版本回调，保留 callMethod 对象数组参数原样透传并支持 getSpecString，解决云米净水器等插件属性加载问题
- 标准插件与原生动画：支持 dev_mode=0 标准插件（miot.plugin.spec，如米家空气净化器 4）动态注入 spec instance 与多语言字典；完整实现 NativeAnimatedModule 原生驱动粒子动画并消除空 Image 占位黑边框

3、修改那些文件

- `mjhm/entry/src/main/ets/model/Models.ets`（修改）
- `mjhm/entry/src/main/ets/pages/DeviceList.ets`（修改）
- `mjhm/entry/src/main/ets/pages/Home.ets`（修改）
- `mjhm/entry/src/main/ets/pages/PluginHost.ets`（修改）
- `mjhm/entry/src/main/ets/service/ApiService.ets`（修改）
- `mjhm/entry/src/main/ets/service/MiCloud.ets`（修改）
- `mjhm/entry/src/main/ets/service/PluginStore.ets`（修改）
- `mjhm/entry/src/main/ets/service/RnHostWarm.ets`（修改）
- `mjhm/entry/src/main/module.json5`（修改）
- `mjhm/entry/src/main/resources/base/element/string.json`（修改）
- `mjhm/entry/src/main/resources/rawfile/rnhost/rnhost/host.js`（修改）


## 第3次修改

<!-- changelog-id: 8f11040007275a15 -->

1、修改了什么需求

家庭定位自动切换、设备官方排序与图标、净水器数据及标准插件动画支持

2、完成情况

- 家庭自动切换与位置权限：新增 GET_WIFI_INFO 及位置权限申请，支持按当前连接 Wi-Fi 路由器 BSSID 与经纬度距离自动匹配切换家庭
- 设备排序与真实产品图标：接入 /v2/home/get_union_order 与 gethome_merged 房间顺序对齐米家官方固定排序；接入 /v2/productconfig/single_pull 渲染真实产品透明 PNG 图标并持久化缓存
- 插件数据与桥接修复：修复 MIOTDevice/MIOTService/MIOTSpec 回调签名与隐私授权版本回调，保留 callMethod 对象数组参数原样透传并支持 getSpecString，解决云米净水器等插件属性加载问题
- 标准插件与原生动画：支持 dev_mode=0 标准插件（miot.plugin.spec，如米家空气净化器 4）动态注入 spec instance 与多语言字典；完整实现 NativeAnimatedModule 原生驱动粒子动画并消除空 Image 占位黑边框

3、修改那些文件

- `mjhm/entry/src/main/ets/model/Models.ets M` → `mjhm/entry/src/main/ets/pages/DeviceList.ets M`（修改）


## 第2次修改

<!-- changelog-id: ccc7cd05a7ea46a9 -->

1、修改了什么需求

更新忽略文件

2、完成情况

已完成并提交。

3、修改那些文件

- `mjhm/.hvigor/cache/file-cache.json`（删除）
- `mjhm/.hvigor/cache/meta.json`（删除）
- `mjhm/.hvigor/cache/task-cache.json`（删除）
- `mjhm/.hvigor/dependencyMap/dependencyMap.json5`（删除）
- `mjhm/.hvigor/dependencyMap/entry/oh-package.json5`（删除）
- `mjhm/.hvigor/dependencyMap/oh-package.json5`（删除）
- `mjhm/.hvigor/outputs/build-logs/build.log`（删除）
- `mjhm/.hvigor/outputs/build-logs/build.log.1`（删除）
- `mjhm/.hvigor/outputs/build-logs/build.log.2`（删除）
- `mjhm/.hvigor/outputs/logs/details/details.json`（删除）
- `mjhm/.hvigor/outputs/patch/patch.json`（删除）
- `mjhm/.hvigor/outputs/sync/fileCache.json`（删除）
- `mjhm/.hvigor/outputs/sync/output.json`（删除）
- `mjhm/.idea/.deveco/cxx/.clang-format`（删除）
- `mjhm/.idea/.deveco/module/entry.cache.json`（删除）
- `mjhm/.idea/.deveco/project.cache.json`（删除）
- `mjhm/.idea/.gitignore`（删除）
- `mjhm/.idea/modules.xml`（删除）
- `mjhm/.idea/modules/entry.iml`（删除）
- `mjhm/.idea/modules/mjhm.iml`（删除）
- `mjhm/.idea/vcs.xml`（删除）
- `mjhm/entry/build/config/buildConfig.json`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/.ts_checker_cache`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/.tsbuildinfo`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/.tsbuildinfo.linter`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/compileInfo.json`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compileContextInfo.json`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/ApiService.ets-0b59c8f75c2fa3bfe8bba7a685638a6b8734d4ab546a2313f95a844261c6f3c8.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/AppConfig.ets-9c8aa265e77bc7c193fcd8152c2b4a9bd45b5ecdc534e1f5a008ca7ae70105ea.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/DeviceControl.ets-05986be43391236a70009106c93b4b406fd06affb9b0daa011708c614015bcf2.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/DeviceList.ets-e4e8b6f6c467fd69f4af1f266d8659bba9f8c6012475326a3b06811962650e43.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/EntryAbility.ets-39d93678ef0cfd906d83889c2390a31e49b4cc47cb36987d1a01fe2dd353f7a3.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Home.ets-159b56738ab1d57643fb996e7f4aacec4b8a529138c52098078a319c1c1dbdc3.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Index.ets-a6426e26ffab9a4beb0ca861dbf7f6c60e0010f4de42c45610cb774dfd2fa5e6.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Login.ets-539b13f2bc9cb865924744c1d38a3ce79f327efcb7103e2e1981a03cd153202b.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/MiCloud.ets-02d1e4fc6de3f75077a5f6ce42045fb1a4f65fc40a86fa2427032783b0144d21.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/MiCrypto.ets-815021113952a91b9a1b7c02592302b0a201a774dbd2544a20ae67dbde1931e9.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Profile.ets-171f99bbae3e2f1f6171c05397d98b168a80e885469467d62674a5fe5fb6d03d.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/RoomList.ets-b05ca5fb21198020c2fdcdfb477b4762eb140ecadeace102f081404480e9be8e.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/SceneEdit.ets-4051fa337a25f3fc69529a48e2b897ba43c186f8db33615e1bff55948067a8be.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/SceneList.ets-f72c2c72ee0e76a02a1726c484625299cf790276e8076c20f93489e6893c2bec.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Settings.ets-9f8780ec5889e5fcce8151fd96070b6949654373745c0c9607a9a26e293bb13e.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/modules/Storage.ets-45658adf1760796391b53ba45a7ea0620a370e7e012d156f61ec8a369528646c.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/other/pkgName2SourceRoots.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/compiler.cache/plugins/plugins.msgpack`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/dep_info.json`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/common/AppConfig.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/common/AppConfig.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/entryability/EntryAbility.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/entryability/EntryAbility.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/DeviceControl.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/DeviceControl.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/DeviceList.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/DeviceList.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Home.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Home.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Index.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Index.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Login.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Login.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Profile.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Profile.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/RoomList.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/RoomList.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/SceneEdit.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/SceneEdit.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/SceneList.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/SceneList.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Settings.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/pages/Settings.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/ApiService.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/ApiService.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/MiCloud.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/MiCloud.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/MiCrypto.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/MiCrypto.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/Storage.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/service/Storage.ts`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/filesInfo.txt`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/modules.cache`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/npmEntries.protoBin`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/npmEntries.txt`（删除）
- `mjhm/entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/sourceMaps.json`（删除）
- `mjhm/entry/build/default/generated/profile/default/BuildProfile.ets`（删除）
- `mjhm/entry/build/default/generated/r/default/ResourceTable.h`（删除）
- `mjhm/entry/build/default/intermediates/hap_metadata/default/output_metadata.json`（删除）
- `mjhm/entry/build/default/intermediates/loader/default/loader.json`（删除）
- `mjhm/entry/build/default/intermediates/loader/default/pkgContextInfo.json`（删除）
- `mjhm/entry/build/default/intermediates/loader_out/default/ets/modules.abc`（删除）
- `mjhm/entry/build/default/intermediates/loader_out/default/ets/sourceMaps.map`（删除）
- `mjhm/entry/build/default/intermediates/merge_profile/default/module.json`（删除）
- `mjhm/entry/build/default/intermediates/package/default/module.json`（删除）
- `mjhm/entry/build/default/intermediates/patch/default/base_native_libs.json`（删除）
- `mjhm/entry/build/default/intermediates/process_profile/default/module.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/ResourceTable.txt`（删除）
- `mjhm/entry/build/default/intermediates/res/default/ark_module.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/ids_map/id_defined.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/module.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/opt-compression.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resConfig.json`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources.index`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/app_icon.png`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/ic_chevron_down.svg`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/ic_home.svg`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/ic_person.svg`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/ic_power.svg`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/media/icon.png`（删除）
- `mjhm/entry/build/default/intermediates/res/default/resources/base/profile/main_pages.json`（删除）
- `mjhm/entry/build/default/intermediates/router_map/default/loader-router-map.json`（删除）
- `mjhm/entry/build/default/intermediates/router_map/default/temp-router-map.json`（删除）
- `mjhm/entry/build/default/intermediates/share_config/default/temp-share-config.json`（删除）
- `mjhm/entry/build/default/intermediates/source_map/default/sourceMaps.map`（删除）
- `mjhm/entry/build/default/outputs/default/entry-default-signed.hap`（删除）
- `mjhm/entry/build/default/outputs/default/entry-default-unsigned.hap`（删除）
- `mjhm/entry/build/default/outputs/default/mapping/sourceMaps.map`（删除）
- `mjhm/entry/build/default/outputs/default/pack.info`（删除）
- `mjhm/local.properties`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/BuildProfile.ets`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/LICENSE`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/README.md`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/build-profile.json5`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/hvigorfile.ts`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/index.d.ts`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/index.ets`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/index.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/index.ts`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/oh-package.json5`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/Constant.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/core.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/event.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/interface.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module.json`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/ExpectExtend.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertClose.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertContain.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertFail.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertFalse.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertInstanceOf.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertLarger.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertLargerOrEqual.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertLess.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertLessOrEqual.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertNaN.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertNegUnlimited.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertNull.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPosUnlimited.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsPending.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejected.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWith.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWithError.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolved.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolvedWith.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertThrowError.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/assertUndefined.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/DeepTypeUtils.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/assertDeepEquals.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/assert/isPromiseLike.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/config/DataDriver.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/config/Filter.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/config/configService.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/coverage/coverageCollect.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/kit/SysTestKit.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/mock/ArgumentMatchers.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/mock/ExtendInterface.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/mock/MockKit.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/mock/VerificationMode.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/report/LogExpectError.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/report/OhReport.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/module/report/ReportExtend.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/service.js`（删除）
- `mjhm/oh_modules/.ohpm/@ohos+hypium@1.0.19/oh_modules/@ohos/hypium/src/main/testrunner/OpenHarmonyTestRunner.ts`（删除）
- `mjhm/oh_modules/.ohpm/lock.json5`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/BuildProfile.ets`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/LICENSE`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/README.md`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/build-profile.json5`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/hvigorfile.ts`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/index.d.ts`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/index.ets`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/index.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/index.ts`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/oh-package.json5`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/Constant.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/core.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/event.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/interface.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module.json`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/ExpectExtend.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertClose.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertContain.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertFail.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertFalse.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertInstanceOf.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertLarger.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertLargerOrEqual.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertLess.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertLessOrEqual.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertNaN.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertNegUnlimited.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertNull.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPosUnlimited.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsPending.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejected.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWith.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWithError.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolved.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolvedWith.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertThrowError.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/assertUndefined.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/DeepTypeUtils.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/assertDeepEquals.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/assert/isPromiseLike.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/config/DataDriver.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/config/Filter.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/config/configService.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/coverage/coverageCollect.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/kit/SysTestKit.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/mock/ArgumentMatchers.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/mock/ExtendInterface.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/mock/MockKit.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/mock/VerificationMode.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/report/LogExpectError.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/report/OhReport.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/module/report/ReportExtend.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/service.js`（删除）
- `mjhm/oh_modules/.ohpm/oh_modules/@ohos/hypium/src/main/testrunner/OpenHarmonyTestRunner.ts`（删除）
- `mjhm/oh_modules/@ohos/hypium/BuildProfile.ets`（删除）
- `mjhm/oh_modules/@ohos/hypium/LICENSE`（删除）
- `mjhm/oh_modules/@ohos/hypium/README.md`（删除）
- `mjhm/oh_modules/@ohos/hypium/build-profile.json5`（删除）
- `mjhm/oh_modules/@ohos/hypium/hvigorfile.ts`（删除）
- `mjhm/oh_modules/@ohos/hypium/index.d.ts`（删除）
- `mjhm/oh_modules/@ohos/hypium/index.ets`（删除）
- `mjhm/oh_modules/@ohos/hypium/index.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/index.ts`（删除）
- `mjhm/oh_modules/@ohos/hypium/oh-package.json5`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/Constant.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/core.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/event.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/interface.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module.json`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/ExpectExtend.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertClose.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertContain.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertFail.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertFalse.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertInstanceOf.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertLarger.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertLargerOrEqual.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertLess.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertLessOrEqual.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertNaN.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertNegUnlimited.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertNull.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPosUnlimited.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsPending.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejected.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWith.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsRejectedWithError.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolved.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertPromiseIsResolvedWith.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertThrowError.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/assertUndefined.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/DeepTypeUtils.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/deepEquals/assertDeepEquals.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/assert/isPromiseLike.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/config/DataDriver.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/config/Filter.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/config/configService.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/coverage/coverageCollect.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/kit/SysTestKit.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/mock/ArgumentMatchers.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/mock/ExtendInterface.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/mock/MockKit.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/mock/VerificationMode.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/report/LogExpectError.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/report/OhReport.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/module/report/ReportExtend.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/service.js`（删除）
- `mjhm/oh_modules/@ohos/hypium/src/main/testrunner/OpenHarmonyTestRunner.ts`（删除）
- `mjhm/rnhost_cdp_after_style.png`（删除）


## 第1次修改

<!-- changelog-id: da11fee7b1d6764f -->

1、修改了什么需求

更新忽略文件

2、完成情况

已完成并提交。

3、修改那些文件

- `mjhm/.hvigor/cache/file-cache.json D` → `mjhm/.hvigor/cache/meta.json D`（删除）
