import { router, promptAction } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import * as Storage from '../service/Storage';
import { AppConfig, Logger } from '../common/AppConfig';
import { Home, Device, UserInfo } from '../model/Models';

const TAG = 'Profile';

/**
 * 我的（个人中心，对标原版截图 06_我的页面 / 31_我的页面_下半）：
 * - 用户卡：昵称 + 「N个家庭 | N个智能设备」（真实聚合）
 * - 家庭卡：真实家庭列表（成员数暂无接口则显示房间/设备数）
 * - 菜单组：更多设置（真实子页）等，未实现项提示
 * - 退出登录：真实清理本地登录态
 */
@Component
export struct ProfileTab {
  @State devices: Device[] = [];
  @State homes: Home[] = [];
  @State nickname: string = '我的';
  @State userId: string = '';
  /** 登出回调（父组件传入，跳转登录页） */
  onLoggedOut: () => void = () => {};

  async aboutToAppear(): Promise<void> {
    const user: UserInfo | null = await Storage.getObject<UserInfo>(AppConfig.KEY_USER);
    if (user !== null) {
      this.nickname = user.nickname;
      this.userId = user.userId;
    }
  }

  async refreshStats(): Promise<void> {
    try {
      this.homes = await ApiService.getHomes();
      this.devices = await ApiService.getDevices('');
    } catch (e) {
      Logger.error(TAG, `refreshStats failed: ${e}`);
    }
  }

  async logout(): Promise<void> {
    await Storage.clear(AppConfig.KEY_TOKEN);
    await Storage.clear(AppConfig.KEY_USER);
    await Storage.clear(AppConfig.KEY_CLOUD_DEVICES);
    Logger.info(TAG, 'logged out');
    this.onLoggedOut();
  }

  build() {
    Column() {
      Scroll() {
        Column() {
          // 用户卡（深色，对标原版）
          Row() {
            Column() {
              Text(this.nickname)
                .fontSize(26)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
              Text('管理账号、会员权益等')
                .fontSize(13)
                .fontColor('#999999')
                .margin({ top: 6 })
              Text(`${this.homes.length}个家庭 | ${this.devices.length}个智能设备`)
                .fontSize(13)
                .fontColor('#4A90D9')
                .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .backgroundColor('#E8F3FF')
                .borderRadius(16)
                .margin({ top: 10 })
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)

            Text('👤')
              .fontSize(26)
              .width(64)
              .height(64)
              .textAlign(TextAlign.Center)
              .backgroundColor('#E8EDF2')
              .borderRadius(32)
          }
          .width('100%')
          .padding(20)
          .margin({ left: 16, right: 16, top: 16 })

          // 家庭卡（真实家庭列表）
          ForEach(this.homes, (home: Home) => {
            Row() {
              Column() {
                Text(home.name)
                  .fontSize(17)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#1A1A1A')
                Text(`${home.roomCount}个房间 | ${home.deviceCount}个设备`)
                  .fontSize(13)
                  .fontColor('#999999')
                  .margin({ top: 4 })
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              Text('›')
                .fontSize(22)
                .fontColor('#CCCCCC')
            }
            .width('100%')
            .padding(18)
            .backgroundColor('#FFFFFF')
            .borderRadius(14)
            .margin({ left: 16, right: 16, top: 12 })
          })

          // 菜单组一
          Column() {
            this.MenuItem('📦', '设备耗材', '', () => {
              this.toast('设备耗材即将上线');
            })
            this.Divider()
            this.MenuItem('🎙️', '语音控制', '', () => {
              this.toast('语音控制即将上线');
            })
            this.Divider()
            this.MenuItem('🌐', '家庭网络', '良好', () => {
              this.toast('家庭网络即将上线');
            })
            this.Divider()
            this.MenuItem('🔗', '中枢与网关', '', () => {
              this.toast('中枢与网关即将上线');
            })
            this.Divider()
            this.MenuItem('⚙️', '更多设置', '', () => {
              router.pushUrl({ url: 'pages/Settings' });
            })
          }
          .width('100%')
          .padding({ top: 4, bottom: 4 })
          .backgroundColor('#FFFFFF')
          .borderRadius(14)
          .margin({ left: 16, right: 16, top: 16 })

          // 菜单组二
          Column() {
            this.MenuItem('🛒', '商城中心', '', () => {
              this.toast('商城中心未开启');
            })
            this.Divider()
            this.MenuItem('🏠', '全屋智能', '', () => {
              this.toast('全屋智能即将上线');
            })
            this.Divider()
            this.MenuItem('🛠️', '小米服务', '', () => {
              this.toast('小米服务即将上线');
            })
            this.Divider()
            this.MenuItem('💬', '帮助与反馈', '', () => {
              this.toast('帮助与反馈即将上线');
            })
          }
          .width('100%')
          .padding({ top: 4, bottom: 4 })
          .backgroundColor('#FFFFFF')
          .borderRadius(14)
          .margin({ left: 16, right: 16, top: 16 })

          // 地区
          Row() {
            Text('地区')
              .fontSize(15)
              .fontColor('#1A1A1A')
            Blank()
            Text('中国大陆')
              .fontSize(14)
              .fontColor('#999999')
          }
          .width('100%')
          .padding(18)
          .backgroundColor('#FFFFFF')
          .borderRadius(14)
          .margin({ left: 16, right: 16, top: 16 })

          // 退出登录
          Text('退出登录')
            .fontSize(16)
            .fontColor('#E53935')
            .width('100%')
            .textAlign(TextAlign.Center)
            .padding(16)
            .backgroundColor('#FFFFFF')
            .borderRadius(14)
            .margin({ left: 16, right: 16, top: 16, bottom: 30 })
            .onClick(() => {
              this.logout();
            })
        }
        .width('100%')
      }
      .scrollBar(BarState.Off)
      .layoutWeight(1)
      .onAppear(() => {
        this.refreshStats();
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }

  toast(msg: string): void {
    promptAction.showToast({ message: msg, duration: 1500 });
  }

  @Builder
  MenuItem(icon: string, label: string, extra: string, action: () => void) {
    Row() {
      Text(icon)
        .fontSize(20)
        .width(36)
        .height(36)
        .textAlign(TextAlign.Center)
        .backgroundColor('#F2F4F7')
        .borderRadius(10)
      Text(label)
        .fontSize(16)
        .fontColor('#1A1A1A')
        .margin({ left: 14 })
        .layoutWeight(1)
      if (extra !== '') {
        Text(extra)
          .fontSize(14)
          .fontColor('#999999')
          .margin({ right: 6 })
      }
      Text('›')
        .fontSize(20)
        .fontColor('#CCCCCC')
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .onClick(() => {
      action();
    })
  }

  @Builder
  Divider() {
    Row()
      .width('100%')
      .height(0.5)
      .backgroundColor('#F0F0F0')
      .margin({ left: 66 })
  }
}
