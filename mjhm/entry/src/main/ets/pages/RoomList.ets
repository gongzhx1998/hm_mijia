import { router } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import { Home, Room } from '../model/Models';

/**
 * 房间/家庭管理页：展示真实家庭与房间（数据来自米家云 /homeroom/gethome）
 */
@Entry
@Component
struct RoomList {
  @State homes: Home[] = [];
  @State rooms: Room[] = [];
  @State currentHomeId: string = '';

  async aboutToAppear(): Promise<void> {
    this.homes = await ApiService.getHomes();
    if (this.homes.length > 0) {
      this.currentHomeId = this.homes[0].homeId;
      this.rooms = await ApiService.getRooms(this.currentHomeId);
    }
  }

  @Builder
  RoomRow(room: Room) {
    Row() {
      Text('🏠').fontSize(24)
      Column() {
        Text(room.name)
          .fontSize(15)
          .fontColor('#1A1A1A')
        Text(`${room.deviceCount} 个设备`)
          .fontSize(12)
          .fontColor('#999999')
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
  }

  build() {
    Column() {
      Row() {
        Text('←')
          .fontSize(20)
          .onClick(() => { router.back(); })
        Text(this.homeName())
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .margin({ left: 12 })
        Blank()
        Text('＋ 添加房间')
          .fontSize(14)
          .fontColor('#1677FF')
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 12 })

      if (this.rooms.length === 0) {
        Column() {
          Text('🏠')
            .fontSize(48)
          Text('暂无房间')
            .fontSize(15)
            .fontColor('#999999')
            .margin({ top: 12 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Scroll() {
          Column() {
            ForEach(this.rooms, (room: Room) => {
              this.RoomRow(room)
            })
          }
          .padding({ left: 16, right: 16, bottom: 20 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }

  homeName(): string {
    for (let i = 0; i < this.homes.length; i++) {
      if (this.homes[i].homeId === this.currentHomeId) {
        return this.homes[i].name;
      }
    }
    return '房间';
  }
}
