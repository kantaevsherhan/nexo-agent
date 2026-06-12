export interface GatewayEvent {
  platform: string;
  chatId: string;
  userId: string;
  content: string;
  timestamp: number;
}

export interface GatewayResponse {
  chatId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export abstract class PlatformAdapter {
  abstract readonly platform: string;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(chatId: string, content: string): Promise<void>;
  abstract start(): Promise<void>;

  protected messageHandler?: (event: GatewayEvent) => Promise<string>;

  onMessage(handler: (event: GatewayEvent) => Promise<string>): void {
    this.messageHandler = handler;
  }
}
