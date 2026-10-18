import { Device, Home, Room, Scene, DeviceCommand } from '../model/Models';
import { AppConfig, Logger } from '../common/AppConfig';
import * as MiCloud from './MiCloud';
import * as Storage from './Storage';

const TAG = 'ApiService';

/**
 * 数据服务层 —— 全真实，无 mock：
 * - 设备/家庭/房间：登录小米账号后从米家云拉取（本地缓存，含局域网 token/ip）
 * - 设备控制：miIO 局域网协议（UDP 54321 + AES）直控真实设备
 * - 场景：本地创建 + 本地存储，手动执行时逐个动作真实下发
 */

/** 获取真实家庭列表 */
export async function getHomes(): Promise<Home[]> {
  const cloudHomes = await MiCloud.getHomeList('cn');
  const homes: Home[] = [];
  for (let i = 0; i < cloudHomes.length; i++) {
    let count = 0;
    for (let j = 0; j < cloudHomes[i].rooms.length; j++) {
      count += cloudHomes[i].rooms[j].dids.length;
    }
    const h: Home = {
      homeId: cloudHomes[i].id,
      name: cloudHomes[i].name,
      roomCount: cloudHomes[i].rooms.length,
      deviceCount: count
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
}

async function buildHomeRoomMaps(): Promise<HomeRoomMaps> {
  const homeOf: Record<string, string> = {};
  const roomOf: Record<string, string> = {};
  const cloudHomes = await MiCloud.getHomeList('cn');
  for (let i = 0; i < cloudHomes.length; i++) {
    const rooms = cloudHomes[i].rooms;
    for (let j = 0; j < rooms.length; j++) {
      const dids = rooms[j].dids;
      for (let k = 0; k < dids.length; k++) {
        homeOf[dids[k]] = cloudHomes[i].id;
        roomOf[dids[k]] = rooms[j].id;
      }
    }
  }
  const maps: HomeRoomMaps = { homeOf: homeOf, roomOf: roomOf };
  return maps;
}

/** 获取真实设备列表（按家庭 + 可选房间过滤；homeId 为空表示不过滤，返回全量） */
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
  const devices: Device[] = [];
  for (let i = 0; i < cached.length; i++) {
    const cd = cached[i];
    const hid = maps.homeOf[cd.did] ?? '';
    const rid = maps.roomOf[cd.did] ?? '';
    // 按家庭过滤（homeId 非空时）
    if (homeId !== '' && hid !== homeId) {
      continue;
    }
    if (roomId !== undefined && rid !== roomId) {
      continue;
    }
    devices.push(cloudToDevice(cd, rid));
  }
  return devices;
}

/** 切换家庭后强制重新拉取设备并刷新缓存（避免缓存里只有旧家庭设备） */
export async function reloadDevicesForHome(homeId: string): Promise<Device[]> {
  const fresh = await MiCloud.getDevices('cn');
  await Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, fresh);
  return getDevices(homeId);
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
