import { router } from '@kit.ArkUI';
import * as Storage from '../service/Storage';
import { AppConfig } from '../common/AppConfig';

/**
 * 启动入口页：判断登录态，路由到登录页或首页
 */
@Entry
@Component
struct Index {
  @State loading: boolean = true;

  async aboutToAppear(): Promise<void> {
    const token = await Storage.getString(AppConfig.KEY_TOKEN, '');
    this.loading = false;
    if (token !== '') {
      router.replaceUrl({ url: 'pages/Home' });
    } else {
      router.replaceUrl({ url: 'pages/Login' });
    }
  }

  build() {
    Column() {
      if (this.loading) {
        LoadingProgress()
          .width(48)
          .height(48)
          .color('#1677FF')
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFFFFF')
  }
}
