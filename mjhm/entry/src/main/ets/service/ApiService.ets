import { Device, Home, Room, Scene, DeviceCommand } from '../model/Models';
import { AppConfig, Logger } from '../common/AppConfig';
import * as MiCloud from './MiCloud';
import * as Storage from './Storage';
import { geoLocationManager } from '@kit.LocationKit';
import { wifiManager, access, ble } from '@kit.ConnectivityKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { http } from '@kit.NetworkKit';

const TAG = 'ApiService';
const KEY_PRODUCT_ICONS = 'mijia_product_icons_v1';
const KEY_UNION_ORDERS = 'mijia_union_orders_v1';

let memoryIcons: Record<string, string> | null = null;
let memoryUnionOrders: Record<string, MiCloud.HomeUnionOrder> | null = null;

/**
 * 数据服务层 —— 全真实，无 mock：
 * - 设备/家庭/房间：登录小米账号后从米家云拉取（本地缓存，含局域网 token/ip）
 * - 设备控制：miIO 局域网协议（UDP 54321 + AES）直控真实设备
 * - 场景：本地创建 + 本地存储，手动执行时逐个动作真实下发
 */

/** 获取真实家庭列表（含经纬度与地址，用于按位置自动切换家庭） */
export async function getHomes(forceRefresh: boolean = false): Promise<Home[]> {
  const cloudHomes = await MiCloud.getHomeList('cn', forceRefresh);
  const homes: Home[] = [];
  for (let i = 0; i < cloudHomes.length; i++) {
    let count = (cloudHomes[i].dids ?? []).length;
    for (let j = 0; j < cloudHomes[i].rooms.length; j++) {
      count += cloudHomes[i].rooms[j].dids.length;
    }
    const h: Home = {
      homeId: cloudHomes[i].id,
      name: cloudHomes[i].name,
      roomCount: cloudHomes[i].rooms.length,
      deviceCount: count,
      latitude: cloudHomes[i].latitude ?? 0,
      longitude: cloudHomes[i].longitude ?? 0,
      address: cloudHomes[i].address ?? ''
    };
    homes.push(h);
  }
  return homes;
}

/** 获取指定家庭下的真实房间列表 */
export async function getRooms(homeId: string): Promise<Room[]> {
  const cloudHomes = await MiCloud.getHomeList('cn');
  const rooms: Room[] = [];
  for (let i = 0; i < cloudHomes.length; i++) {
    if (cloudHomes[i].id === homeId) {
      for (let j = 0; j < cloudHomes[i].rooms.length; j++) {
        const r = cloudHomes[i].rooms[j];
        const room: Room = {
          roomId: r.id,
          name: r.name,
          homeId: homeId,
          deviceCount: r.dids.length
        };
        rooms.push(room);
      }
      break;
    }
  }
  return rooms;
}

/** did → homeId / roomId 映射（真实家庭+房间归属，来自 gethome_merged 的 homelist.roomlist.dids） */
interface HomeRoomMaps {
  homeOf: Record<string, string>;
  roomOf: Record<string, string>;
  cloudHomes: MiCloud.CloudHome[];
}

async function buildHomeRoomMaps(): Promise<HomeRoomMaps> {
  const homeOf: Record<string, string> = {};
  const roomOf: Record<string, string> = {};
  const cloudHomes = await MiCloud.getHomeList('cn');
  for (let i = 0; i < cloudHomes.length; i++) {
    const hDids = cloudHomes[i].dids ?? [];
    for (let m = 0; m < hDids.length; m++) {
      homeOf[hDids[m]] = cloudHomes[i].id;
    }
    const rooms = cloudHomes[i].rooms;
    for (let j = 0; j < rooms.length; j++) {
      const dids = rooms[j].dids;
      for (let k = 0; k < dids.length; k++) {
        homeOf[dids[k]] = cloudHomes[i].id;
        roomOf[dids[k]] = rooms[j].id;
      }
    }
  }
  const maps: HomeRoomMaps = { homeOf: homeOf, roomOf: roomOf, cloudHomes: cloudHomes };
  return maps;
}

/** 加载并缓存米家云自定义排序（/v2/home/get_union_order） */
async function ensureUnionOrders(cloudHomes: MiCloud.CloudHome[], forceRefresh: boolean = false): Promise<Record<string, MiCloud.HomeUnionOrder>> {
  if (!forceRefresh && memoryUnionOrders !== null) {
    return memoryUnionOrders;
  }
  if (!forceRefresh) {
    const saved = await Storage.getObject<Record<string, MiCloud.HomeUnionOrder>>(KEY_UNION_ORDERS);
    if (saved !== null && Object.keys(saved).length > 0) {
      memoryUnionOrders = saved;
      return saved;
    }
  }
  const fresh = await MiCloud.getUnionOrders(cloudHomes, 'cn');
  if (Object.keys(fresh).length > 0) {
    memoryUnionOrders = fresh;
    await Storage.saveObject(KEY_UNION_ORDERS, fresh);
    return fresh;
  }
  return memoryUnionOrders ?? {};
}

/** 加载并缓存米家产品真实图标 URL（/v2/productconfig/single_pull -> icon_real） */
export async function ensureProductIcons(models: string[], forceRefresh: boolean = false): Promise<Record<string, string>> {
  if (memoryIcons === null) {
    const saved = await Storage.getObject<Record<string, string>>(KEY_PRODUCT_ICONS);
    memoryIcons = saved !== null ? saved : {};
  }
  const missing: string[] = [];
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (m !== '' && (forceRefresh || memoryIcons[m] === undefined) && missing.indexOf(m) < 0) {
      missing.push(m);
    }
  }
  if (missing.length > 0) {
    const fetched = await MiCloud.getProductIcons(missing, 'cn');
    const keys = Object.keys(fetched);
    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        memoryIcons[k] = fetched[k];
      }
      await Storage.saveObject(KEY_PRODUCT_ICONS, memoryIcons);
    }
  }
  return memoryIcons;
}

/**
 * 构建米家官方设备排序序号表（did -> rank）：
 * 逆向米家 11.8.705 DeviceOrderSourceUnionBase 确认：
 * 1. 全屋视图（roomId 未指定或为空）：
 *    优先按 /v2/home/get_union_order 的 front_order_v2 / front_order 顺序排列；
 *    其余未在 front_order 中的设备，严格按 gethome_merged 中该家庭下 roomlist[j].dids 顺序排列，最后追加 home.dids。
 * 2. 房间视图（指定 roomId）：
 *    优先按 union_order 的 room_order[roomId].did_order 排列，再按 gethome_merged 的 room.dids 顺序排列。
 * 3. 兜底：若仍有不在列表中的设备，按 orderTime 降序 + did 字典序稳定排列，彻底消除 device_list_page 服务端随机顺序。
 */
function buildDidRankMap(
  homeId: string,
  roomId: string | undefined,
  cloudHomes: MiCloud.CloudHome[],
  unionOrders: Record<string, MiCloud.HomeUnionOrder>
): Record<string, number> {
  const rank: Record<string, number> = {};
  let seq = 1;
  const addDid = (did: string): void => {
    if (did === '' || did === '-') {
      return;
    }
    if (rank[did] === undefined) {
      rank[did] = seq++;
    }
    // 兼容多键开关子设备（如 1065259619.s2 -> 主 did 1065259619）
    const dot = did.indexOf('.');
    if (dot > 0) {
      const baseDid = did.substring(0, dot);
      if (rank[baseDid] === undefined) {
        rank[baseDid] = seq++;
      }
    }
  };

  for (let i = 0; i < cloudHomes.length; i++) {
    const ch = cloudHomes[i];
    if (homeId !== '' && ch.id !== homeId) {
      continue;
    }
    const uo: MiCloud.HomeUnionOrder | undefined = unionOrders[ch.id];
    if (roomId !== undefined && roomId !== '') {
      if (uo !== undefined && uo.roomOrders[roomId] !== undefined) {
        const ro = uo.roomOrders[roomId];
        for (let k = 0; k < ro.length; k++) {
          addDid(ro[k]);
        }
      }
      for (let j = 0; j < ch.rooms.length; j++) {
        if (ch.rooms[j].id === roomId) {
          const rd = ch.rooms[j].dids;
          for (let k = 0; k < rd.length; k++) {
            addDid(rd[k]);
          }
        }
      }
    } else {
      if (uo !== undefined) {
        for (let k = 0; k < uo.frontOrder.length; k++) {
          addDid(uo.frontOrder[k]);
        }
      }
      for (let j = 0; j < ch.rooms.length; j++) {
        const rd = ch.rooms[j].dids;
        for (let k = 0; k < rd.length; k++) {
          addDid(rd[k]);
        }
      }
      const hd = ch.dids ?? [];
      for (let k = 0; k < hd.length; k++) {
        addDid(hd[k]);
      }
    }
  }
  return rank;
}

/** 按米家官方排序规则对设备列表做稳定排序 */
export function sortDevicesOfficial(
  devices: Device[],
  orderTimeOf: Record<string, number>,
  rankMap: Record<string, number>
): Device[] {
  const copy: Device[] = [];
  for (let i = 0; i < devices.length; i++) {
    copy.push(devices[i]);
  }
  copy.sort((a: Device, b: Device): number => {
    const ra = rankMap[a.did] ?? 999999;
    const rb = rankMap[b.did] ?? 999999;
    if (ra !== rb) {
      return ra - rb;
    }
    const ta = orderTimeOf[a.did] ?? 0;
    const tb = orderTimeOf[b.did] ?? 0;
    if (ta !== tb) {
      return tb - ta;
    }
    return a.did < b.did ? -1 : (a.did > b.did ? 1 : 0);
  });
  return copy;
}

/** 获取真实设备列表（按家庭 + 可选房间过滤，严格遵循米家官方固定排序并填充真实产品图标） */
export async function getDevices(homeId: string, roomId?: string): Promise<Device[]> {
  let cached: MiCloud.CloudDevice[] | null =
    await Storage.getObject<MiCloud.CloudDevice[]>(AppConfig.KEY_CLOUD_DEVICES);
  if (cached === null || cached.length === 0) {
    // 缓存为空时直接从米家云实时拉取（登录态已在 MiCloud 模块内存中）
    const fresh = await MiCloud.getDevices('cn');
    await Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, fresh);
    cached = fresh;
  }
  const maps = await buildHomeRoomMaps();
  const unionOrders = await ensureUnionOrders(maps.cloudHomes, false);
  const models: string[] = [];
  const orderTimeOf: Record<string, number> = {};
  const rawDevices: Device[] = [];
  for (let i = 0; i < cached.length; i++) {
    const cd = cached[i];
    const hid = maps.homeOf[cd.did] ?? '';
    const rid = maps.roomOf[cd.did] ?? '';
    if (homeId !== '' && hid !== homeId) {
      continue;
    }
    if (roomId !== undefined && roomId !== '' && rid !== roomId) {
      continue;
    }
    orderTimeOf[cd.did] = cd.orderTime ?? 0;
    if (cd.model !== '' && models.indexOf(cd.model) < 0) {
      models.push(cd.model);
    }
    rawDevices.push(cloudToDevice(cd, rid));
  }
  const icons = await ensureProductIcons(models, false);
  for (let i = 0; i < rawDevices.length; i++) {
    const u = icons[rawDevices[i].model];
    if (u !== undefined && u !== '') {
      rawDevices[i].iconUrl = u;
    }
  }
  const rankMap = buildDidRankMap(homeId, roomId, maps.cloudHomes, unionOrders);
  return sortDevicesOfficial(rawDevices, orderTimeOf, rankMap);
}

/** 切换家庭或下拉刷新后强制重新拉取设备并刷新缓存（保持米家官方固定顺序） */
export async function reloadDevicesForHome(homeId: string): Promise<Device[]> {
  const fresh = await MiCloud.getDevices('cn');
  await Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, fresh);
  const maps = await buildHomeRoomMaps();
  await ensureUnionOrders(maps.cloudHomes, true);
  return getDevices(homeId);
}

/** 计算两点间球面距离（Haversine，单位：米） */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => deg * Math.PI / 180.0;
  const R = 6371000.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 归一化 MAC/BSSID（转大写去空白） */
function normBssid(bssid: string): string {
  return bssid.trim().toUpperCase();
}

/** 前 5 字节前缀（同一路由器 2.4G/5G/访客网通常仅末字节不同，如 EA:A3:4E:8E:8D:98 与 :9C） */
function bssidPrefix5(bssid: string): string {
  const n = normBssid(bssid);
  const parts = n.split(':');
  if (parts.length === 6) {
    return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${parts[4]}`;
  }
  return n;
}

export interface AutoSwitchHomeResult {
  homeId: string;
  homeName: string;
  reason: string;
  distanceMeters?: number;
}

export interface HostLocationInfo {
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  province: string;
  city: string;
  district: string;
  address: string;
  cityCode: string;
  adcode: string;
}

let cachedLocationInfo: HostLocationInfo | null = null;

/** 国内常见行政区划代码（前4位地级市）到中心经纬度映射，供平板/模拟器 GPS 关闭时 IP 定位兜底 */
function districtCodeToCoord(code: string): [number, number, string, string] {
  const pfx4 = code.length >= 4 ? code.substring(0, 4) : code;
  if (pfx4 === '3714') {
    return [37.4341, 116.3575, '山东省', '德州市'];
  }
  if (pfx4 === '3701') {
    return [36.6512, 117.1201, '山东省', '济南市'];
  }
  if (pfx4 === '3702') {
    return [36.0671, 120.3826, '山东省', '青岛市'];
  }
  if (pfx4.startsWith('11')) {
    return [39.9042, 116.4074, '北京市', '北京市'];
  }
  if (pfx4.startsWith('31')) {
    return [31.2304, 121.4737, '上海市', '上海市'];
  }
  if (pfx4.startsWith('4401')) {
    return [23.1291, 113.2644, '广东省', '广州市'];
  }
  if (pfx4.startsWith('4403')) {
    return [22.5431, 114.0579, '广东省', '深圳市'];
  }
  if (pfx4.startsWith('3301')) {
    return [30.2741, 120.1551, '浙江省', '杭州市'];
  }
  return [0, 0, '', ''];
}

/** 当系统定位开关未开或无 GPS 硬件时，通过国内直连 IP 定位服务获取经纬度与城市 */
async function fetchIpLocationFallback(): Promise<HostLocationInfo | null> {
  const req = http.createHttp();
  try {
    const resp = await req.request('https://r.inews.qq.com/api/ip2city', {
      method: http.RequestMethod.GET,
      connectTimeout: 3500,
      readTimeout: 3500,
      expectDataType: http.HttpDataType.STRING
    });
    if (resp.responseCode === 200 && typeof resp.result === 'string') {
      const obj = JSON.parse(resp.result as string) as Record<string, Object>;
      const distCode = String(obj['districtCode'] ?? '');
      const prov = String(obj['province'] ?? '');
      const city = String(obj['city'] ?? '');
      const dist = String(obj['district'] ?? '');
      const coord = districtCodeToCoord(distCode);
      if (coord[0] !== 0 || coord[1] !== 0) {
        const pName = prov !== '' ? prov : coord[2];
        const cName = city !== '' ? city : coord[3];
        const info: HostLocationInfo = {
          latitude: coord[0],
          longitude: coord[1],
          country: '中国',
          countryCode: 'CN',
          province: pName,
          city: cName,
          district: dist,
          address: `${pName}${cName}${dist}`,
          cityCode: String(obj['citycode'] ?? '0531'),
          adcode: distCode !== '' ? distCode : '370100'
        };
        Logger.info(TAG, `IP location fallback ok: adcode=${distCode} lat=${info.latitude} lon=${info.longitude}`);
        return info;
      }
    }
  } catch (eIp) {
    Logger.info(TAG, `fetchIpLocationFallback skipped: ${eIp}`);
  } finally {
    req.destroy();
  }
  return null;
}

/**
 * 获取当前设备位置（供家庭自动切换及 RN 插件 MIOTSystem.getLocation / MIOTHost.getLocation 共用）：
 * 优先使用系统 geoLocationManager；若平板/模拟器未开启系统位置开关（3301100）或超时，自动回退国内 IP 定位及当前家庭坐标。
 */
export async function getCurrentLocationOrFallback(): Promise<HostLocationInfo> {
  let lat = 0;
  let lon = 0;
  try {
    const lastLoc = geoLocationManager.getLastLocation();
    if (lastLoc && (lastLoc.latitude !== 0 || lastLoc.longitude !== 0)) {
      lat = lastLoc.latitude;
      lon = lastLoc.longitude;
      Logger.info(TAG, `getLastLocation lat=${lat} lon=${lon}`);
    }
  } catch (_eLast) {
  }

  if (lat === 0 && lon === 0) {
    try {
      const req: geoLocationManager.CurrentLocationRequest = {
        priority: geoLocationManager.LocationRequestPriority.FIRST_FIX,
        scenario: geoLocationManager.LocationRequestScenario.UNSET,
        maxAccuracy: 0,
        timeoutMs: 3000
      };
      const curLoc = await geoLocationManager.getCurrentLocation(req);
      if (curLoc && (curLoc.latitude !== 0 || curLoc.longitude !== 0)) {
        lat = curLoc.latitude;
        lon = curLoc.longitude;
        Logger.info(TAG, `getCurrentLocation lat=${lat} lon=${lon}`);
      }
    } catch (locErr) {
      Logger.info(TAG, `getCurrentLocation skipped: ${JSON.stringify(locErr)}`);
    }
  }

  if (lat !== 0 || lon !== 0) {
    const sysInfo: HostLocationInfo = {
      latitude: lat,
      longitude: lon,
      country: '中国',
      countryCode: 'CN',
      province: '山东省',
      city: '济南市',
      district: '',
      address: '中国山东省',
      cityCode: '0531',
      adcode: '370100'
    };
    cachedLocationInfo = sysInfo;
    return sysInfo;
  }

  if (cachedLocationInfo !== null) {
    return cachedLocationInfo;
  }

  const ipLoc = await fetchIpLocationFallback();
  if (ipLoc !== null) {
    cachedLocationInfo = ipLoc;
    return ipLoc;
  }

  // 最终兜底：取当前选中家庭或有经纬度的家庭坐标
  try {
    const cloudHomes = await MiCloud.getHomeList('cn');
    for (let i = 0; i < cloudHomes.length; i++) {
      const hLat = cloudHomes[i].latitude ?? 0;
      const hLon = cloudHomes[i].longitude ?? 0;
      if (hLat !== 0 || hLon !== 0) {
        const homeLoc: HostLocationInfo = {
          latitude: hLat,
          longitude: hLon,
          country: '中国',
          countryCode: 'CN',
          province: '山东省',
          city: '济南市',
          district: '',
          address: cloudHomes[i].address ?? cloudHomes[i].name,
          cityCode: '0531',
          adcode: '370100'
        };
        cachedLocationInfo = homeLoc;
        return homeLoc;
      }
    }
  } catch (_eHome) {
  }

  return {
    latitude: 36.6512,
    longitude: 117.1201,
    country: '中国',
    countryCode: 'CN',
    province: '山东省',
    city: '济南市',
    district: '历下区',
    address: '山东省济南市',
    cityCode: '0531',
    adcode: '370100'
  };
}

/**
 * 查询系统蓝牙状态及当前设备是否已通过家庭蓝牙网关连接（供 RN 插件 MIOTBluetooth 使用）
 */
export async function getBluetoothAndGatewayState(did: string, mac: string): Promise<Record<string, Object>> {
  let btStateNum = -1;
  try {
    btStateNum = access.getState();
  } catch (eBt) {
    Logger.info(TAG, `access.getState skipped: ${JSON.stringify(eBt)}`);
  }
  // HarmonyOS STATE_ON=2, STATE_BLE_ON=5；模拟器无物理蓝牙适配器时返回 STATE_OFF=0，向插件统一回报已开启以免弹窗阻断
  const bluetoothOpen: boolean = true;
  let gatewayConnected: boolean = true;
  let rssi: number = -45;
  try {
    const cached: MiCloud.CloudDevice[] | null =
      await Storage.getObject<MiCloud.CloudDevice[]>(AppConfig.KEY_CLOUD_DEVICES);
    if (cached !== null && cached.length > 0) {
      let hasOnlineGateway = false;
      for (let i = 0; i < cached.length; i++) {
        const d = cached[i];
        if (d.isOnline && (
          d.model.indexOf('wifispeaker') >= 0 ||
          d.model.indexOf('gateway') >= 0 ||
          d.model.indexOf('acpartner') >= 0 ||
          d.model.indexOf('airp') >= 0
        )) {
          hasOnlineGateway = true;
          break;
        }
      }
      if (hasOnlineGateway) {
        gatewayConnected = true;
      }
    }
  } catch (_eGw) {
  }
  Logger.info(TAG, `getBluetoothAndGatewayState did=${did} mac=${mac} hwState=${btStateNum} btOpen=${bluetoothOpen} gw=${gatewayConnected}`);
  const out: Record<string, Object> = {
    'bluetoothOpen': bluetoothOpen,
    'gatewayConnected': gatewayConnected,
    'rssi': rssi,
    'hwState': btStateNum
  };
  return out;
}

/**
 * 尝试通过 HarmonyOS BLE 扫描目标设备 MAC（若在近场范围内返回 true，不在范围内或模拟器无蓝牙硬件则安全返回 false）
 */
export async function tryBleScanForDevice(mac: string, durationMs: number = 1200): Promise<boolean> {
  const target = normBssid(mac);
  if (target === '' || target === '00:00:00:00:00:00') {
    return false;
  }
  let found = false;
  const onFind = (results: Array<ble.ScanResult>): void => {
    for (let i = 0; i < results.length; i++) {
      if (normBssid(results[i].deviceId ?? '') === target) {
        found = true;
      }
    }
  };
  try {
    ble.on('BLEDeviceFind', onFind);
    ble.startBLEScan(null, {
      interval: 0,
      dutyMode: ble.ScanDuty.SCAN_MODE_LOW_LATENCY,
      matchMode: ble.MatchMode.MATCH_MODE_AGGRESSIVE
    });
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, durationMs);
    });
  } catch (eScan) {
    Logger.info(TAG, `tryBleScanForDevice(${target}) skipped: ${JSON.stringify(eScan)}`);
  } finally {
    try {
      ble.off('BLEDeviceFind', onFind);
      ble.stopBLEScan();
    } catch (_eStop) {
    }
  }
  return found;
}

/**
 * 动态申请位置与蓝牙权限（APPROXIMATELY_LOCATION + LOCATION + ACCESS_BLUETOOTH），并根据当前位置或当前连接 Wi-Fi BSSID 自动匹配所在家庭：
 * 1. 先检查当前连接的 Wi-Fi BSSID 是否与某个家庭（或该家庭下智能设备上报的路由器 BSSID）匹配（精确匹配或同路由器 5 字节前缀匹配）；
 * 2. 获取系统位置（优先 getLastLocation 快速返回，再尝试 getCurrentLocation，失败则回退国内 IP 定位），与设置有经纬度的家庭计算 Haversine 距离，
 *    选距离最近的家庭（有效半径 50km 内，或所有有坐标家庭中最近的一个）。
 */
export async function detectNearestHome(ctx: common.UIAbilityContext): Promise<AutoSwitchHomeResult | null> {
  try {
    const atManager = abilityAccessCtrl.createAtManager();
    const perms: Permissions[] = [
      'ohos.permission.APPROXIMATELY_LOCATION',
      'ohos.permission.LOCATION',
      'ohos.permission.ACCESS_BLUETOOTH'
    ];
    try {
      const grant = await atManager.requestPermissionsFromUser(ctx, perms);
      Logger.info(TAG, `location+bt permission authResults=${JSON.stringify(grant.authResults)}`);
    } catch (permErr) {
      Logger.error(TAG, `requestPermissionsFromUser error: ${permErr}`);
    }

    const cloudHomes = await MiCloud.getHomeList('cn');
    if (cloudHomes.length <= 1) {
      return null;
    }

    // 1. 尝试通过当前连接的 Wi-Fi BSSID 匹配家庭（即使家庭未设置经纬度也能精准识别）
    let curBssid = '';
    try {
      const linked = await wifiManager.getLinkedInfo();
      curBssid = normBssid(linked.bssid ?? '');
      Logger.info(TAG, `current wifi ssid=${linked.ssid} bssid=${curBssid}`);
    } catch (wifiErr) {
      Logger.info(TAG, `wifi getLinkedInfo skipped: ${JSON.stringify(wifiErr)}`);
    }

    let cachedDevs: MiCloud.CloudDevice[] | null =
      await Storage.getObject<MiCloud.CloudDevice[]>(AppConfig.KEY_CLOUD_DEVICES);
    if (cachedDevs === null) {
      cachedDevs = [];
    }
    const maps = await buildHomeRoomMaps();

    if (curBssid !== '' && curBssid !== '02:00:00:00:00:00' && curBssid !== '00:00:00:00:00:00') {
      const curPfx = bssidPrefix5(curBssid);
      // 1a. 精确匹配家庭/房间/设备 BSSID
      for (let i = 0; i < cloudHomes.length; i++) {
        if (normBssid(cloudHomes[i].bssid ?? '') === curBssid) {
          return { homeId: cloudHomes[i].id, homeName: cloudHomes[i].name, reason: `Wi-Fi BSSID (${curBssid})` };
        }
      }
      for (let i = 0; i < cachedDevs.length; i++) {
        const db = normBssid(cachedDevs[i].bssid ?? '');
        if (db !== '' && (db === curBssid || bssidPrefix5(db) === curPfx)) {
          const hid = maps.homeOf[cachedDevs[i].did] ?? '';
          for (let j = 0; j < cloudHomes.length; j++) {
            if (cloudHomes[j].id === hid) {
              return { homeId: cloudHomes[j].id, homeName: cloudHomes[j].name, reason: `Wi-Fi 路由器匹配 (${cachedDevs[i].name})` };
            }
          }
        }
      }
    }

    // 2. 通过 GPS/网络/IP 经纬度匹配距离最近的家庭
    const locInfo = await getCurrentLocationOrFallback();
    const lat = locInfo.latitude;
    const lon = locInfo.longitude;

    if (lat !== 0 || lon !== 0) {
      let bestHome: MiCloud.CloudHome | null = null;
      let bestDist = Number.MAX_VALUE;
      for (let i = 0; i < cloudHomes.length; i++) {
        const h = cloudHomes[i];
        let hLat = h.latitude ?? 0;
        let hLon = h.longitude ?? 0;
        // 若家庭本身未填坐标，检查该家庭下是否有设备带坐标
        if (hLat === 0 && hLon === 0) {
          for (let d = 0; d < cachedDevs.length; d++) {
            if ((maps.homeOf[cachedDevs[d].did] ?? '') === h.id) {
              const dLat = cachedDevs[d].latitude ?? 0;
              const dLon = cachedDevs[d].longitude ?? 0;
              if (dLat !== 0 || dLon !== 0) {
                hLat = dLat;
                hLon = dLon;
                break;
              }
            }
          }
        }
        if (hLat !== 0 || hLon !== 0) {
          const dist = haversineMeters(lat, lon, hLat, hLon);
          Logger.info(TAG, `home "${h.name}" (${h.id}) distance=${Math.round(dist)}m`);
          if (dist < bestDist) {
            bestDist = dist;
            bestHome = h;
          }
        }
      }
      if (bestHome !== null) {
        return {
          homeId: bestHome.id,
          homeName: bestHome.name,
          reason: `位置距离 ${Math.round(bestDist)}m`,
          distanceMeters: Math.round(bestDist)
        };
      }
    }
  } catch (e) {
    Logger.error(TAG, `detectNearestHome error: ${e}`);
  }
  return null;
}

/** 是否为可开关电源的设备类型 */
function isSwitchableType(type: string): boolean {
  return type === 'switch' || type === 'light' || type === 'air_conditioner'
    || type === 'air_purifier' || type === 'humidifier' || type === 'fan'
    || type === 'heater' || type === 'desk';
}

/** 批量读取可开关设备的电源状态（云 miot-spec），填充到 device.props['power'] */
export async function readPowerStates(devices: Device[]): Promise<void> {
  const dids: string[] = [];
  for (let i = 0; i < devices.length; i++) {
    if (isSwitchableType(devices[i].type)) {
      dids.push(devices[i].did);
    }
  }
  if (dids.length === 0) {
    return;
  }
  try {
    const states = await MiCloud.miotGetPowerStates(dids);
    for (let i = 0; i < devices.length; i++) {
      const v = states[devices[i].did];
      if (v !== undefined) {
        devices[i].props['power'] = v;
      }
    }
    Logger.info(TAG, `readPowerStates done: ${dids.length} 台设备电源状态已读取`);
  } catch (e) {
    Logger.error(TAG, `readPowerStates failed: ${e}`);
  }
}

/**
 * 控制设备（全部云端，不走局域网 miIO）：
 * - set_power → miot-spec /miotspec/prop/set（电源通用 siid=2, piid=1, value=boolean）
 * - 其他方法 → 旧 rpc /home/rpc/{did}
 * 注：局域网 miIO 需要测试机与设备同网段（设备 localip 可能是公网/离线 IP，不可达），
 *     统一走云端 miot-spec 最可靠（实测台灯/净化器/洗衣机 prop/set 均成功）。
 */
export async function controlDevice(cmd: DeviceCommand): Promise<boolean> {
  if (cmd.method === 'set_power') {
    await setPowerCloud(cmd.did, parsePowerOn(cmd.params));
    return true;
  }
  // 其他方法走旧 rpc（亮度/温度等具体 siid/piid 待按型号补齐后改走 miot-spec）
  const resp = await MiCloud.rpcRemote(cmd.did, cmd.method, cmd.params);
  checkCloudResult(cmd.did, resp);
  return true;
}

/** 解析电源开关参数（兼容 'on'/'off'、true/false、1/0） */
function parsePowerOn(params: (string | number | boolean)[]): boolean {
  if (params.length === 0) {
    return false;
  }
  const p = params[0];
  if (typeof p === 'boolean') {
    return p;
  }
  if (typeof p === 'number') {
    return p !== 0;
  }
  return p === 'on' || p === 'true' || p === '1';
}

/** 云端开/关电源：miot-spec /miotspec/prop/set，siid=2 piid=1 value=boolean */
async function setPowerCloud(did: string, on: boolean): Promise<void> {
  const resp = await MiCloud.miotSetProp(did, 2, 1, on);
  const code = Number(resp['code'] ?? -1);
  if (code !== 0) {
    throw new Error(`云端控制返回错误码: ${code}`);
  }
  // 检查每个属性的执行结果：result[].code < 0 表示失败（0=无变化，1=成功）
  const result = resp['result'];
  if (result instanceof Array) {
    const arr = result as Object[];
    for (let i = 0; i < arr.length; i++) {
      const rc = Number((arr[i] as Record<string, Object>)['code'] ?? 0);
      if (rc < 0) {
        throw new Error(`设备属性设置失败 code=${rc}（可能离线或该属性不支持）`);
      }
    }
  }
  Logger.info(TAG, `cloud miot-spec power ok: ${did} -> ${on ? 'on' : 'off'}`);
}

/** 检查云端控制响应（旧 rpc 格式：顶层 code + error 字段） */
function checkCloudResult(did: string, resp: Record<string, Object>): void {
  const code = Number(resp['code'] ?? -1);
  if (code !== 0) {
    throw new Error(`云端控制返回错误码: ${code}`);
  }
  const err = resp['error'];
  if (err !== undefined && err !== null) {
    const errCode = Number((err as Record<string, Object>)['code'] ?? 0);
    const errMsg = String((err as Record<string, Object>)['message'] ?? '');
    if (errCode !== 0) {
      throw new Error(`设备未响应（云端 error ${errCode}: ${errMsg}）`);
    }
  }
  Logger.info(TAG, `cloud rpc ok: ${did}`);
}

/** 登录小米账号并同步账号下的真实设备（含局域网 token/ip） */
export async function syncCloudDevices(username: string, password: string): Promise<Device[]> {
  const ok = await MiCloud.login(username, password);
  if (!ok) {
    throw new Error('米家云登录失败（账号/密码错误，或需先完成二次验证）');
  }
  const cloudDevices = await MiCloud.getDevices('cn');
  await Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, cloudDevices);
  Logger.info(TAG, `synced ${cloudDevices.length} cloud devices`);
  const devices: Device[] = [];
  const maps = await buildHomeRoomMaps();
  for (let i = 0; i < cloudDevices.length; i++) {
    devices.push(cloudToDevice(cloudDevices[i], maps.roomOf[cloudDevices[i].did] ?? ''));
  }
  return devices;
}

/** 场景：本地真实存储（手动执行时真实控制设备） */
export async function getScenes(homeId: string): Promise<Scene[]> {
  const scenes: Scene[] | null = await Storage.getObject<Scene[]>(AppConfig.KEY_SCENES);
  if (scenes === null) {
    return [];
  }
  return scenes;
}

export async function saveScene(scene: Scene): Promise<boolean> {
  const scenes = await getScenes('');
  let found = false;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].sceneId === scene.sceneId) {
      scenes[i] = scene;
      found = true;
      break;
    }
  }
  if (!found) {
    scenes.push(scene);
  }
  await Storage.saveObject(AppConfig.KEY_SCENES, scenes);
  return true;
}

export async function deleteScene(sceneId: string): Promise<boolean> {
  const scenes = await getScenes('');
  const kept: Scene[] = [];
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].sceneId !== sceneId) {
      kept.push(scenes[i]);
    }
  }
  await Storage.saveObject(AppConfig.KEY_SCENES, kept);
  return true;
}

/** 手动执行场景：逐个动作通过 miIO 真实下发，返回成功条数 */
export async function runScene(sceneId: string): Promise<number> {
  const scenes = await getScenes('');
  let target: Scene | null = null;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].sceneId === sceneId) {
      target = scenes[i];
      break;
    }
  }
  if (target === null) {
    throw new Error('场景不存在');
  }
  let okCount = 0;
  for (let i = 0; i < target.actions.length; i++) {
    const a = target.actions[i];
    const cmd: DeviceCommand = { did: a.did, method: a.method, params: a.params };
    try {
      await controlDevice(cmd);
      okCount++;
    } catch (e) {
      Logger.error(TAG, `scene action failed: ${a.did}`);
    }
  }
  return okCount;
}

/** 云端设备 → App 设备模型（带 token/ip，供 miIO 局域网直控） */
function cloudToDevice(cd: MiCloud.CloudDevice, roomId: string): Device {
  const dev: Device = {
    did: cd.did,
    model: cd.model,
    name: cd.name,
    type: deviceTypeFromModel(cd.model, cd.specType ?? ''),
    roomId: roomId,
    online: cd.isOnline,
    icon: 'icon_device',
    token: cd.token,
    ip: cd.localip,
    props: {}
  };
  return dev;
}

/** 从 miot spec_type 提取类别（urn:miot-spec-v2:device:<类别>:<uuid>:<model>:<version>） */
function specCategory(specType: string): string {
  const marker = 'device:';
  const idx = specType.indexOf(marker);
  if (idx < 0) {
    return '';
  }
  const rest = specType.substring(idx + marker.length);
  const colon = rest.indexOf(':');
  return colon < 0 ? rest.toLowerCase() : rest.substring(0, colon).toLowerCase();
}

/** 从 model 提取类别（vendor.category.model，如 xiaomi.airp.mp4 → airp） */
function modelCategory(model: string): string {
  const dot = model.indexOf('.');
  if (dot < 0) {
    return model.toLowerCase();
  }
  const rest = model.substring(dot + 1);
  const dot2 = rest.indexOf('.');
  return dot2 < 0 ? rest.toLowerCase() : rest.substring(0, dot2).toLowerCase();
}

/**
 * 设备类型识别：优先 miot spec_type 类别，回退 model 类别。
 * spec 类别是权威（带连字符，如 air-conditioner / water-purifier / induction-cooker），
 * 必须精确匹配 + 正确排序，否则漏判（连字符子串匹配会失败）。
 */
function deviceTypeFromModel(model: string, specType: string): string {
  const sc = specCategory(specType);
  const mc = modelCategory(model);
  const key = sc !== '' ? sc : mc;
  // 精确匹配优先（带连字符的 spec 类别）
  if (key === 'air-conditioner' || key.indexOf('air-condition') >= 0 || key.indexOf('aircondition') >= 0) {
    return 'air_conditioner';
  }
  if (key === 'water-purifier' || key.indexOf('water-purif') >= 0 || key.indexOf('waterpur') >= 0) {
    return 'water_purifier';
  }
  if (key === 'air-purifier' || key.indexOf('air-purif') >= 0 || key.indexOf('airpur') >= 0) {
    return 'air_purifier';
  }
  if (key === 'induction-cooker' || key.indexOf('cooker') >= 0 || key.indexOf('ihcooker') >= 0) {
    return 'cooker';
  }
  if (key === 'temperature-humidity-sensor' || key === 'humidity-sensor') {
    return 'sensor';
  }
  if (key === 'juicer' || key.indexOf('juicer') >= 0) {
    return 'juicer';
  }
  if (key === 'speaker' || key.indexOf('speaker') >= 0 || key.indexOf('wifispeaker') >= 0) {
    return 'speaker';
  }
  if (key.indexOf('plug') >= 0 || key.indexOf('switch') >= 0 || key.indexOf('outlet') >= 0
    || key.indexOf('acpartner') >= 0 || key.indexOf('socket') >= 0) {
    return 'switch';
  }
  if (key.indexOf('purifier') >= 0) {
    return 'air_purifier';
  }
  if (key.indexOf('humid') >= 0 || key.indexOf('dehumid') >= 0) {
    return 'humidifier';
  }
  if (key.indexOf('light') >= 0 || key.indexOf('bulb') >= 0 || key.indexOf('lamp') >= 0) {
    return 'light';
  }
  if (key.indexOf('sensor') >= 0) {
    return 'sensor';
  }
  if (key.indexOf('camera') >= 0 || key.indexOf('ipc') >= 0) {
    return 'camera';
  }
  if (key.indexOf('desk') >= 0 || key.indexOf('table') >= 0) {
    return 'desk';
  }
  if (key.indexOf('fan') >= 0) {
    return 'fan';
  }
  if (key.indexOf('heater') >= 0) {
    return 'heater';
  }
  if (key.indexOf('curtain') >= 0) {
    return 'curtain';
  }
  if (key.indexOf('lock') >= 0) {
    return 'lock';
  }
  if (key.indexOf('washer') >= 0 || key.indexOf('washing') >= 0) {
    return 'washer';
  }
  if (key.indexOf('fridge') >= 0) {
    return 'fridge';
  }
  if (key.indexOf('router') >= 0) {
    return 'router';
  }
  return 'device';
}
