import { socket } from '@kit.NetworkKit';
import * as MiCrypto from './MiCrypto';

const MIIO_PORT = 54321;

/**
 * miIO 协议客户端
 * 实现 python-miio 的局域网控制协议：
 * UDP 54321 + AES-128-CBC 加密 + token 校验和
 */
export class MiioClient {
  private ip: string = '';
  private token: Uint8Array = new Uint8Array(16);
  private deviceId: number = 0;
  private seq: number = 0;

  constructor(ip: string, tokenHex: string, deviceId: number = 0) {
    this.ip = ip;
    this.token = MiCrypto.fromHex(tokenHex);
    this.deviceId = deviceId;
  }

  /** 发送加密命令，返回解密后的 JSON 对象 */
  async send(method: string, params: (string | number | boolean)[]): Promise<Record<string, Object>> {
    this.seq++;
    const payload: Record<string, Object> = {
      'id': this.seq,
      'method': method,
      'params': params
    };
    const plain = MiCrypto.utf8Bytes(JSON.stringify(payload));
    const keyIv = await MiCrypto.deriveKeyIv(this.token);
    const encrypted = await MiCrypto.aesCbcEncrypt(plain, keyIv.key, keyIv.iv);

    const packet = await this.buildPacket(encrypted);
    const resp = await rawSend(this.ip, packet);
    return await this.parseResponse(resp, keyIv.key, keyIv.iv);
  }

  /** 构建 32 字节头 + 密文 */
  private async buildPacket(encrypted: Uint8Array): Promise<Uint8Array> {
    const header = new Uint8Array(32);
    const dv = new DataView(header.buffer);
    dv.setUint16(0, 0x2131);
    dv.setUint16(2, 32 + encrypted.length);
    dv.setUint32(4, 0);
    dv.setUint32(8, this.deviceId);
    dv.setUint32(12, Math.floor(Date.now() / 1000));

    const toHash = new Uint8Array(16 + this.token.length + encrypted.length);
    toHash.set(header.slice(0, 16), 0);
    toHash.set(this.token, 16);
    toHash.set(encrypted, 16 + this.token.length);
    const checksumHex = await MiCrypto.md5(toHash);
    const checksum = MiCrypto.fromHex(checksumHex);
    header.set(checksum, 16);

    const packet = new Uint8Array(header.length + encrypted.length);
    packet.set(header, 0);
    packet.set(encrypted, header.length);
    return packet;
  }

  private async parseResponse(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Record<string, Object>> {
    if (data.length <= 32) {
      throw new Error('响应过短');
    }
    const encrypted = data.slice(32);
    const decrypted = await MiCrypto.aesCbcDecrypt(encrypted, key, iv);
    const jsonStr = MiCrypto.utf8String(decrypted);
    return JSON.parse(jsonStr) as Record<string, Object>;
  }
}

/**
 * 发送 hello 握手，从响应 checksum 提取 token（仅部分老设备支持）
 */
export async function discoverToken(ip: string): Promise<string> {
  const hello = MiCrypto.fromHex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const resp = await rawSend(ip, hello);
  const token = new Uint8Array(resp.slice(16, 32));
  return MiCrypto.toHex(token);
}

async function rawSend(ip: string, data: Uint8Array): Promise<Uint8Array> {
  const udp = socket.constructUDPSocketInstance();
  const addr: socket.NetAddress = {
    address: ip,
    port: MIIO_PORT,
    family: 1
  };
  const bindAddr: socket.NetAddress = { address: '0.0.0.0', port: 0 };
  await udp.bind(bindAddr);
  // 关键：必须先注册 message 监听再 send，否则局域网内毫秒级响应会在监听注册前到达而丢失，
  // 导致 3 秒超时（之前的竞态 bug：send 之后才 on('message')）。
  const resp: Promise<Uint8Array> = new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      udp.close();
      reject(new Error('超时'));
    }, 3000);
    udp.on('message', (value: socket.SocketMessageInfo) => {
      clearTimeout(timer);
      udp.close();
      resolve(new Uint8Array(value.message));
    });
  });
  await udp.send({ data: data.buffer, address: addr });
  return await resp;
}
