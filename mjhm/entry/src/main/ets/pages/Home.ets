import { router } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import * as Storage from '../service/Storage';
import * as MiCloud from '../service/MiCloud';
import { AppConfig, Logger, setStatusBar } from '../common/AppConfig';
import { Room, Device, DeviceCommand, Home } from '../model/Models';
import { ProfileTab } from './Profile';
import { common } from '@kit.AbilityKit';
import { prefetchAll } from '../service/PluginStore';

const TAG = 'Home';

/**
 * 主界面（对标原版米家 SmartHomeMainActivity，2 Tab：米家/我的）：
 * - 首页：家庭名⌄ + 房间Tab（全屋/各房间 + ≡弹层）+ 2列深色设备卡
 * - 我的：个人中心（ProfileTab）
 * 地区固定中国大陆（api.mijia.tech），无隐私/服务器选择页。全真实数据，无 mock。
 */
@Entry
@Component
struct HomePage {
  @State currentTab: number = 0;
  @State homeName: string = '我的家';
  @State homeId: string = '';
  @State homes: Home[] = [];
  @State rooms: Room[] = [];
  @State devices: Device[] = [];
  @State currentRoom: string = '';
  @State loading: boolean = true;
  @State errorMsg: string = '';
  @State showRoomSheet: boolean = false;
  @State showHomeSheet: boolean = false;

  async aboutToAppear(): Promise<void> {
    const token = await Storage.getString(AppConfig.KEY_TOKEN, '');
    if (token === '') {
      router.replaceUrl({ url: 'pages/Login' });
      return;
    }
    // 首页深色背景：状态栏用深蓝 + 白字
    this.applyStatusBar();
    // 恢复米家云登录态（ssecurity/serviceToken/userId），否则云签名请求会因 ssecurity 为空而失败
    await MiCloud.restoreSession();
    await this.loadData();
  }

  /** 根据当前 Tab 设置状态栏颜色（Tab0=深色首页，Tab1=浅色我的） */
  applyStatusBar(): void {
    if (this.currentTab === 0) {
      setStatusBar('#6E93B8', true);
    } else {
      setStatusBar('#F5F6F7', false);
    }
  }

  onPageShow(): void {
    this.applyStatusBar();
  }

  onPageHide(): void {
    // 离开首页进入浅色子页面时恢复浅色状态栏
    setStatusBar('#F5F6F7', false);
  }

  async loadData(): Promise<void> {
    this.loading = true;
    this.errorMsg = '';
    try {
      this.homes = await ApiService.getHomes();
      if (this.homes.length > 0) {
        this.homeName = this.homes[0].name;
        this.homeId = this.homes[0].homeId;
        this.rooms = await ApiService.getRooms(this.homeId);
      }
      this.devices = await ApiService.getDevices(this.homeId);
      // 批量读取可开关设备的电源状态，让开关按钮显示真实状态
      await ApiService.readPowerStates(this.devices);
      Logger.info(TAG, `loadData done: homes=${this.homes.length} rooms=${this.rooms.length} devices=${this.devices.length}`);
      this.startPluginPrefetch();
    } catch (e) {
      Logger.error(TAG, `loadData failed: ${e}`);
      this.errorMsg = '同步失败，请检查网络后下拉重试';
    } finally {
      this.loading = false;
    }
  }

  /**
   * 后台预取所有设备的米家插件：先从云端刷新全量设备列表（缓存可能缺新设备），
   * 再交给 PluginStore 去重/批量查询/限并发下载。不阻塞首页渲染。
   */
  private startPluginPrefetch(): void {
    const ctx: common.Context = getContext(this) as common.UIAbilityContext;
    const fallback: string[] = this.devices.map((d: Device) => d.model);
    setTimeout(() => {
      ApiService.reloadDevicesForHome('').then((all: Device[]) => {
        const models: string[] = all.length > 0 ? all.map((d: Device) => d.model) : fallback;
        prefetchAll(ctx, models);
      }).catch((e: Error) => {
        Logger.error(TAG, `prefetch device list failed: ${e?.message ?? e}`);
        prefetchAll(ctx, fallback);
      });
    }, 1500);
  }

  /** 切换家庭：更新 homeId/homeName，重新拉取该家庭的房间和设备 */
  async switchHome(home: Home): Promise<void> {
    this.showHomeSheet = false;
    if (home.homeId === this.homeId) {
      return;
    }
    this.homeId = home.homeId;
    this.homeName = home.name;
    this.currentRoom = '';
    this.loading = true;
    this.errorMsg = '';
    try {
      this.rooms = await ApiService.getRooms(home.homeId);
      this.devices = await ApiService.reloadDevicesForHome(home.homeId);
      await ApiService.readPowerStates(this.devices);
      Logger.info(TAG, `switchHome done: ${home.name} rooms=${this.rooms.length} devices=${this.devices.length}`);
    } catch (e) {
      Logger.error(TAG, `switchHome failed: ${e}`);
      this.errorMsg = '切换家庭失败，请重试';
    } finally {
      this.loading = false;
    }
  }

  /** 房间 Tab 列表：全屋 + 各房间 */
  roomTabs(): Room[] {
    return this.rooms;
  }

  filteredDevices(): Device[] {
    if (this.currentRoom === '') {
      return this.devices;
    }
    const result: Device[] = [];
    for (let i = 0; i < this.devices.length; i++) {
      if (this.devices[i].roomId === this.currentRoom) {
        result.push(this.devices[i]);
      }
    }
    return result;
  }

  roomName(roomId: string): string {
    for (let i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].roomId === roomId) {
        return this.rooms[i].name;
      }
    }
    return '';
  }

  roomDeviceCount(roomId: string): number {
    let n = 0;
    for (let i = 0; i < this.devices.length; i++) {
      if (this.devices[i].roomId === roomId) {
        n++;
      }
    }
    return n;
  }

  isSwitchable(device: Device): boolean {
    return device.type === 'switch' || device.type === 'light' || device.type === 'air_conditioner'
      || device.type === 'air_purifier' || device.type === 'humidifier' || device.type === 'fan'
      || device.type === 'heater' || device.type === 'desk';
  }

  devicePower(device: Device): boolean {
    return device.props['power'] === true;
  }

  deviceIcon(type: string): string {
    if (type === 'light') {
      return '💡';
    }
    if (type === 'switch') {
      return '🔌';
    }
    if (type === 'sensor') {
      return '🌡️';
    }
    if (type === 'camera') {
      return '📷';
    }
    if (type === 'air_conditioner') {
      return '❄️';
    }
    if (type === 'air_purifier') {
      return '🍃';
    }
    if (type === 'water_purifier') {
      return '🚰';
    }
    if (type === 'humidifier') {
      return '💧';
    }
    if (type === 'desk') {
      return '🪑';
    }
    if (type === 'fan') {
      return '🌀';
    }
    if (type === 'heater') {
      return '🔥';
    }
    if (type === 'curtain') {
      return '🪟';
    }
    if (type === 'lock') {
      return '🔒';
    }
    if (type === 'washer') {
      return '🧺';
    }
    if (type === 'speaker') {
      return '🔊';
    }
    if (type === 'juicer') {
      return '🥤';
    }
    if (type === 'cooker') {
      return '🍳';
    }
    if (type === 'fridge') {
      return '🧊';
    }
    if (type === 'router') {
      return '📶';
    }
    return '📱';
  }

  async toggleDevice(device: Device, isOn: boolean): Promise<void> {
    const cmd: DeviceCommand = { did: device.did, method: 'set_power', params: [isOn ? 'on' : 'off'] };
    try {
      await ApiService.controlDevice(cmd);
      device.props['power'] = isOn;
      // 触发刷新（ArkTS 无展开语法，手动重建数组）
      const next: Device[] = [];
      for (let i = 0; i < this.devices.length; i++) {
        next.push(this.devices[i]);
      }
      this.devices = next;
      Logger.info(TAG, `toggle ok: ${device.name} -> ${isOn}`);
    } catch (e) {
      Logger.error(TAG, `toggle failed: ${e}`);
    }
  }

  build() {
    Tabs({ barPosition: BarPosition.End, index: this.currentTab }) {
      // ===== Tab 1：米家首页 =====
      TabContent() {
        this.HomeContent()
      }
      .tabBar(this.TabBarItem('米家', 0))

      // ===== Tab 2：我的 =====
      TabContent() {
        ProfileTab({
          onLoggedOut: () => {
            router.replaceUrl({ url: 'pages/Login' });
          }
        })
      }
      .tabBar(this.TabBarItem('我的', 1))
    }
    .barHeight(56)
    .onChange((index: number) => {
      this.currentTab = index;
      this.applyStatusBar();
    })
    .width('100%')
    .height('100%')
  }

  // ==================== 首页内容 ====================
  @Builder
  HomeContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 天空蓝渐变背景（原版米家首页风格）
      Column()
        .width('100%')
        .height('100%')
        .linearGradient({
          angle: 180,
          colors: [['#6E93B8', 0], ['#87A9C9', 0.35], ['#A7C2D8', 0.7], ['#C3D6E5', 1]]
        })

      Column() {
        // 顶部图标栏：家庭名⌄ + 消息 + 添加
        Row() {
          Blank()
          Text('🔔')
            .fontSize(22)
            .fontColor('#FFFFFF')
            .margin({ right: 22 })
            .onClick(() => {
              // 消息中心（原版为服务端推送消息，此处留入口）
            })
          Text('＋')
            .fontSize(26)
            .fontWeight(FontWeight.Medium)
            .fontColor('#FFFFFF')
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 12, bottom: 6 })

        // 标题：家庭名⌄（点击弹出家庭切换）
        Row() {
          Text(this.homeName)
            .fontSize(26)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
          Image($r('app.media.ic_chevron_down'))
            .width(14)
            .height(14)
            .fillColor('#FFFFFF')
            .margin({ left: 6 })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 6, bottom: 10 })
        .onClick(() => {
          if (this.homes.length > 1) {
            this.showHomeSheet = true;
          }
        })

        // 房间 Tab 行（全屋 + 各房间 + ≡）
        Row() {
          Scroll() {
            Row() {
              this.RoomTabItem('全屋', '', 0)
              ForEach(this.roomTabs(), (room: Room) => {
                this.RoomTabItem(room.name, room.roomId, this.roomDeviceCount(room.roomId))
              })
            }
          }
          .scrollable(ScrollDirection.Horizontal)
          .scrollBar(BarState.Off)
          .align(Alignment.Start)
          .layoutWeight(1)

          Text('≡')
            .fontSize(20)
            .fontColor('#FFFFFF')
            .margin({ left: 10 })
            .onClick(() => {
              this.showRoomSheet = true;
            })
        }
        .width('100%')
        .padding({ left: 20, right: 16 })
        .margin({ bottom: 14 })

        // 内容区
        if (this.loading) {
          Column() {
            LoadingProgress()
              .width(40)
              .height(40)
              .color('#FFFFFF')
            Text('正在同步设备…')
              .fontSize(13)
              .fontColor('#E8F0F8')
              .margin({ top: 12 })
          }
          .width('100%')
          .layoutWeight(1)
          .justifyContent(FlexAlign.Center)
        } else if (this.errorMsg !== '') {
          Column() {
            Text(this.errorMsg)
              .fontSize(14)
              .fontColor('#F5F5F5')
              .textAlign(TextAlign.Center)
            Text('重试')
              .fontSize(14)
              .fontColor('#FFFFFF')
              .padding({ left: 24, right: 24, top: 8, bottom: 8 })
              .backgroundColor('#33FFFFFF')
              .borderRadius(20)
              .margin({ top: 16 })
              .onClick(() => {
                this.loadData();
              })
          }
          .width('100%')
          .layoutWeight(1)
          .justifyContent(FlexAlign.Center)
        } else {
          Grid() {
            ForEach(this.filteredDevices(), (device: Device) => {
              GridItem() {
                this.DeviceCard(device)
              }
            })
          }
          .columnsTemplate('1fr 1fr')
          .columnsGap(12)
          .rowsGap(12)
          .padding({ left: 16, right: 16 })
          .layoutWeight(1)
          .scrollBar(BarState.Off)
        }
      }
      .width('100%')
      .height('100%')

      // ≡ 房间列表弹层（米家原版样式：白色圆角卡靠右，房间+设备数，底部导航编辑/全部设备）
      if (this.showRoomSheet) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('#33000000')
          .onClick(() => {
            this.showRoomSheet = false;
          })
        Row() {
          Blank()
          Column() {
            Scroll() {
              Column() {
                this.SheetRoomItem('全屋', '', this.devices.length)
                ForEach(this.roomTabs(), (room: Room) => {
                  this.SheetRoomItem(room.name, room.roomId, this.roomDeviceCount(room.roomId))
                })
              }
            }
            .constraintSize({ maxHeight: 420 })
            .scrollBar(BarState.Off)

            Row()
              .width('100%')
              .height(0.5)
              .backgroundColor('#EEEEEE')

            Row() {
              Text('导航编辑')
                .fontSize(17)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
                .layoutWeight(1)
              Text('⚙️')
                .fontSize(20)
            }
            .width('100%')
            .padding({ left: 22, right: 22, top: 16, bottom: 16 })

            Row() {
              Text('全部设备')
                .fontSize(17)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
                .layoutWeight(1)
              Text('🔍')
                .fontSize(20)
            }
            .width('100%')
            .padding({ left: 22, right: 22, top: 4, bottom: 20 })
            .onClick(() => {
              this.showRoomSheet = false;
              this.currentRoom = '';
              router.pushUrl({ url: 'pages/DeviceList' });
            })
          }
          .width('58%')
          .backgroundColor('#FFFFFF')
          .borderRadius(24)
          .margin({ right: 16 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .margin({ top: 128 })
      }

      // 家庭切换弹层（米家原版样式：白色圆角卡，定位项 + 家庭列表（当前绿✓） + 家庭管理）
      if (this.showHomeSheet) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('#33000000')
          .onClick(() => {
            this.showHomeSheet = false;
          })
        Row() {
          Column() {
            // 顶部：定位图标 + 当前家庭名
            Row() {
              Text('📍')
                .fontSize(20)
              Text(this.homeName)
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
                .margin({ left: 12 })
                .layoutWeight(1)
            }
            .width('100%')
            .padding({ left: 20, right: 20, top: 20, bottom: 20 })

            // 家庭列表
            Scroll() {
              Column() {
                ForEach(this.homes, (home: Home) => {
                  this.HomeSheetItem(home)
                })
              }
            }
            .constraintSize({ maxHeight: 320 })
            .scrollBar(BarState.Off)

            Row()
              .width('100%')
              .height(0.5)
              .backgroundColor('#EEEEEE')

            // 底部：家庭管理（占位入口）
            Row() {
              Text('家庭管理')
                .fontSize(18)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
                .layoutWeight(1)
              Text('⚙️')
                .fontSize(20)
            }
            .width('100%')
            .padding({ left: 20, right: 20, top: 18, bottom: 22 })
          }
          .width('88%')
          .backgroundColor('#FFFFFF')
          .borderRadius(24)
          .margin({ left: 16 })
          .alignItems(HorizontalAlign.Start)
          Blank()
        }
        .width('100%')
        .margin({ top: 96 })
      }
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  RoomTabItem(label: string, roomId: string, count: number) {
    Column() {
      Text(label)
        .fontSize(this.currentRoom === roomId ? 18 : 16)
        .fontWeight(this.currentRoom === roomId ? FontWeight.Bold : FontWeight.Normal)
        .fontColor(this.currentRoom === roomId ? '#FFFFFF' : '#D0DEEA')
      // 选中下划线
      Row()
        .width(20)
        .height(3)
        .borderRadius(2)
        .backgroundColor(this.currentRoom === roomId ? '#FFFFFF' : Color.Transparent)
        .margin({ top: 4 })
    }
    .margin({ right: 20 })
    .onClick(() => {
      this.currentRoom = roomId;
    })
  }

  @Builder
  SheetRoomItem(label: string, roomId: string, count: number) {
    Row() {
      Text(label)
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .layoutWeight(1)
      Text(String(count))
        .fontSize(15)
        .fontColor('#AAAAAA')
    }
    .width('100%')
    .padding({ left: 22, right: 22, top: 15, bottom: 15 })
    .onClick(() => {
      this.currentRoom = roomId;
      this.showRoomSheet = false;
    })
  }

  @Builder
  HomeSheetItem(home: Home) {
    Row() {
      Text(home.name)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.homeId === home.homeId ? '#34C759' : '#1A1A1A')
        .layoutWeight(1)
      if (this.homeId === home.homeId) {
        Text('✓')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor('#34C759')
      }
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 16, bottom: 16 })
    .backgroundColor(this.homeId === home.homeId ? '#E8F8EF' : Color.Transparent)
    .onClick(() => {
      this.switchHome(home);
    })
  }

  // 深色设备卡（原版样式：深色圆角卡 + 图标块 + 名称 + 房间·状态）
  @Builder
  DeviceCard(device: Device) {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        // 图标块
        Row() {
          Text(this.deviceIcon(device.type))
            .fontSize(30)
        }
        .width(56)
        .height(56)
        .borderRadius(12)
        .backgroundColor('#33FFFFFF')
        .justifyContent(FlexAlign.Center)

        Blank()

        Text(device.name)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFFFFF')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .textAlign(TextAlign.Start)

        Text(device.online
          ? (this.roomName(device.roomId) === '' ? '未分配房间' : this.roomName(device.roomId))
          : `${this.roomName(device.roomId) === '' ? '' : this.roomName(device.roomId) + ' · '}设备离线`)
          .fontSize(12)
          .fontColor(device.online ? '#B8CBD9' : '#7F93A5')
          .maxLines(1)
          .margin({ top: 3 })
          .width('100%')
          .textAlign(TextAlign.Start)
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
      .height(150)
      .padding(14)

      // 开关类设备：右上角电源按钮（矢量 Path 绘制标准电源符号：弧线缺口+竖线，避免字符渲染歪斜）
      if (this.isSwitchable(device) && device.online) {
        Row() {
          Blank()
          Row() {
            Image($r('app.media.ic_power'))
              .width(17)
              .height(17)
              .fillColor(this.devicePower(device) ? '#FFD54F' : '#B8CBD9')
          }
          .width(34)
          .height(34)
          .borderRadius(17)
          .backgroundColor(this.devicePower(device) ? '#66FFD54F' : '#26FFFFFF')
          .justifyContent(FlexAlign.Center)
          .alignItems(VerticalAlign.Center)
          .onClick(() => {
            this.toggleDevice(device, !this.devicePower(device));
          })
        }
        .width('100%')
        .padding(10)
      }
    }
    .width('100%')
    .height(150)
    .backgroundColor('#D9222B33')
    .borderRadius(16)
    .onClick(() => {
      // 点设备 → 打开该设备自己的米家 RN 插件（按型号下载/缓存）；无插件时插件页自动回退原生控制页
      const params: Record<string, string> = {
        'did': device.did,
        'model': device.model,
        'name': device.name,
        'online': device.online ? '1' : '0'
      };
      router.pushUrl({ url: 'pages/PluginHost', params: params });
    })
    .gesture(LongPressGesture().onAction(() => {
      // 长按：直接进原生控制页
      router.pushUrl({ url: 'pages/DeviceControl', params: { did: device.did } });
    }))
  }

  @Builder
  TabBarItem(label: string, index: number) {
    Column() {
      if (index === 0) {
        Image($r('app.media.ic_home'))
          .width(22)
          .height(22)
          .fillColor(this.currentTab === index ? '#4A90D9' : '#999999')
      } else {
        Image($r('app.media.ic_person'))
          .width(22)
          .height(22)
          .fillColor(this.currentTab === index ? '#4A90D9' : '#999999')
      }
      Text(label)
        .fontSize(11)
        .fontColor(this.currentTab === index ? '#4A90D9' : '#999999')
        .margin({ top: 2 })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}

