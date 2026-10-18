import { router } from '@kit.ArkUI';
import * as Storage from '../service/Storage';
import { AppConfig, Logger } from '../common/AppConfig';

const TAG = 'Settings';

/**
 * 更多设置（对标原版截图 32_更多设置_上部，精简保留真实可用项）：
 * - 地区：中国大陆（固定，对应 api.mijia.tech）
 * - 温度单位：摄氏度（固定）
 * - 检查更新 / 关于：显示版本
 * - 退出登录：真实清理登录态
 */
@Entry
@Component
struct SettingsPage {
  @State nickname: string = '';
  @State version: string = '1.0.0';

  async aboutToAppear(): Promise<void> {
    const userJson = await Storage.getString(AppConfig.KEY_USER, '');
    if (userJson !== '') {
      try {
        const obj = JSON.parse(userJson) as Record<string, string>;
        this.nickname = String(obj['nickname'] ?? '');
      } catch (e) {
        Logger.error(TAG, `parse user failed`);
      }
    }
  }

  async logout(): Promise<void> {
    await Storage.clear(AppConfig.KEY_TOKEN);
    await Storage.clear(AppConfig.KEY_USER);
    await Storage.clear(AppConfig.KEY_CLOUD_DEVICES);
    Logger.info(TAG, 'logged out from settings');
    router.replaceUrl({ url: 'pages/Login' });
  }

  build() {
    Column() {
      // 顶栏
      Row() {
        Text('‹')
          .fontSize(28)
          .fontColor('#1A1A1A')
          .onClick(() => {
            router.back();
          })
        Text('更多设置')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#1A1A1A')
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .margin({ right: 28 })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 10 })

      Scroll() {
        Column() {
          // 地区与语言
          this.GroupTitle('地区与语言')
          Column() {
            this.RowItem('地区', '中国大陆', false, () => {})
            this.GroupDivider()
            this.RowItem('多语言', '默认', false, () => {})
          }
          .width('100%')
          .backgroundColor('#FFFFFF')
          .borderRadius(14)

          // 通用
          this.GroupTitle('通用')
          Column() {
            this.RowItem('温度单位', '摄氏度', false, () => {})
            this.GroupDivider()
            this.RowItem('快捷开关音效', '开', false, () => {})
          }
          .width('100%')
          .backgroundColor('#FFFFFF')
          .borderRadius(14)

          // 关于
          this.GroupTitle('关于')
          Column() {
            this.RowItem('关于米家鸿蒙版', this.version, false, () => {})
            this.GroupDivider()
            this.RowItem('检查更新', '', true, () => {
              Logger.info(TAG, 'check update: already latest');
            })
          }
          .width('100%')
          .backgroundColor('#FFFFFF')
          .borderRadius(14)

          // 退出登录
          Text('退出登录')
            .fontSize(16)
            .fontColor('#E53935')
            .width('100%')
            .textAlign(TextAlign.Center)
            .padding(16)
            .backgroundColor('#FFFFFF')
            .borderRadius(14)
            .margin({ top: 24, bottom: 30 })
            .onClick(() => {
              this.logout();
            })
        }
        .width('100%')
        .padding({ left: 16, right: 16 })
      }
      .scrollBar(BarState.Off)
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }

  @Builder
  GroupTitle(title: string) {
    Text(title)
      .fontSize(13)
      .fontColor('#999999')
      .width('100%')
      .margin({ top: 18, bottom: 8, left: 4 })
  }

  @Builder
  GroupDivider() {
    Row()
      .width('100%')
      .height(0.5)
      .backgroundColor('#F0F0F0')
      .margin({ left: 16 })
  }

  @Builder
  RowItem(label: string, value: string, chevron: boolean, action: () => void) {
    Row() {
      Text(label)
        .fontSize(16)
        .fontColor('#1A1A1A')
        .layoutWeight(1)
      if (value !== '') {
        Text(value)
          .fontSize(14)
          .fontColor('#999999')
      }
      if (chevron) {
        Text('›')
          .fontSize(20)
          .fontColor('#CCCCCC')
          .margin({ left: 6 })
      }
    }
    .width('100%')
    .padding(16)
    .onClick(() => {
      action();
    })
  }
}
