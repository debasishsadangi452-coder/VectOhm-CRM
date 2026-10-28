import { isPrivateAddress } from "./email-connections.service";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "172.15.0.1", "142.250.80.46", "2607:f8b0:4004::200e"])(
    "treats %s as public",
    (ip) => expect(isPrivateAddress(ip)).toBe(false),
  );
});
