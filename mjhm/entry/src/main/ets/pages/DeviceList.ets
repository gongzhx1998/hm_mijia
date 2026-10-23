import { router } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import { Device } from '../model/Models';

/**
 * 全部设备页：按房间分组展示所有真实设备
 */
@Entry
@Component
struct DeviceList {
  @State devices: Device[] = [];
  @State rooms: string[] = [];
  @State roomMap: Record<string, string[]> = {};

  async aboutToAppear(): Promise<void> {
    this.devices = await ApiService.getDevices('');
    this.buildGroup();
    // 后台刷新云端设备列表（缓存可能缺新设备），不阻塞首屏
    try {
      const fresh: Device[] = await ApiService.reloadDevicesForHome('');
      if (fresh.length > 0) {
        this.devices = fresh;
        this.buildGroup();
      }
    } catch (_e) {
    }
  }

  /** 构建 roomId → 设备 did 数组 的映射，以及房间顺序 */
  buildGroup(): void {
    const map: Record<string, string[]> = {};
    const order: string[] = [];
    for (let i = 0; i < this.devices.length; i++) {
      const d = this.devices[i];
      const key = d.roomId === '' ? '__none__' : d.roomId;
      if (map[key] === undefined) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(d.did);
    }
    this.roomMap = map;
    this.rooms = order;
  }

  devicesInRoom(roomKey: string): Device[] {
    const dids = this.roomMap[roomKey];
    const result: Device[] = [];
    if (dids === undefined) {
      return result;
    }
    for (let i = 0; i < this.devices.length; i++) {
      for (let j = 0; j < dids.length; j++) {
        if (this.devices[i].did === dids[j]) {
          result.push(this.devices[i]);
          break;
        }
      }
    }
    return result;
  }

  roomName(roomKey: string): string {
    if (roomKey === '__none__') {
      return '未分组设备';
    }
    return `房间 ${roomKey}`;
  }

  deviceIcon(type: string): string {
    if (type === 'light') {
      return '💡';
    }
    if (type === 'switch') {
      return '🔌';
    }
    if (type === 'sensor') {
      return '📡';
    }
    if (type === 'camera') {
      return '📷';
    }
    return '📦';
  }

  @Builder
  DeviceRow(device: Device) {
    Row() {
      Text(this.deviceIcon(device.type)).fontSize(24)
      Column() {
        Text(device.name)
          .fontSize(15)
          .fontColor('#1A1A1A')
        Text(device.online ? '在线' : '离线')
          .fontSize(12)
          .fontColor(device.online ? '#52C41A' : '#BFBFBF')
          .margin({ top: 3 })
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12 })
      .layoutWeight(1)
      Text('>').fontSize(16).fontColor('#BBBBBB')
    }
    .width('100%')
    .padding(14)
    .backgroundColor('#FFFFFF')
    .borderRadius(12)
    .margin({ bottom: 8 })
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
  RoomGroup(roomKey: string) {
    Column() {
      Row() {
        Text(this.roomName(roomKey))
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#666666')
        Blank()
        Text(`${this.devicesInRoom(roomKey).length} 个设备`)
          .fontSize(12)
          .fontColor('#999999')
      }
      .width('100%')
      .margin({ top: 8, bottom: 10 })

      ForEach(this.devicesInRoom(roomKey), (device: Device) => {
        this.DeviceRow(device)
      })
    }
    .width('100%')
  }

  build() {
    Column() {
      Row() {
        Text('←')
          .fontSize(20)
          .onClick(() => { router.back(); })
        Text('全部设备')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .margin({ left: 12 })
        Blank()
        Text('＋ 添加')
          .fontSize(14)
          .fontColor('#1677FF')
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 12 })

      Scroll() {
        Column() {
          ForEach(this.rooms, (roomKey: string) => {
            this.RoomGroup(roomKey)
          })
        }
        .padding({ left: 16, right: 16, bottom: 20 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }
}
