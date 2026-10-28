import { NotificationsGateway } from "./notifications.gateway";

describe("NotificationsGateway socket path", () => {
  it("defaults to /socket.io (the reverse proxy strips /api before forwarding)", () => {
    const options = Reflect.getMetadata("websockets:gateway_options", NotificationsGateway);
    expect(options.path).toBe(process.env.WS_PATH || "/socket.io");
    if (!process.env.WS_PATH) expect(options.path).not.toContain("/api");
  });
});
