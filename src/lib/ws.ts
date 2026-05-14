import { invoke } from "@tauri-apps/api/core";

export type WsMessage = { type: string; [key: string]: unknown };
type MessageHandler = (msg: WsMessage) => void;

class TopicaWs {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private port: number | null = null;
  private reconnectDelay = 1000;
  private reconnecting = false;
  private closed = false;
  // Only reconnect after the first successful connect() — prevents conflicts with App.tsx health-check loop.
  private established = false;

  async connect(): Promise<void> {
    this.closed = false;
    this.established = false;
    this.port = await invoke<number>("get_backend_port");
    await this.openSocket(this.port);
    this.established = true;
  }

  private openSocket(port: number): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        this.handlers.forEach((h) => h(msg));
      } catch { /* ignore malformed messages */ }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.closed && this.established) this.scheduleReconnect();
    };

    return new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => {
        this.reconnectDelay = 1000;
        resolve();
      };
      this.ws!.onerror = () => reject(new Error("WebSocket connection failed"));
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnecting || this.closed || this.port === null) return;
    this.reconnecting = true;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    setTimeout(async () => {
      this.reconnecting = false;
      if (this.closed || this.port === null) return;
      try {
        await this.openSocket(this.port);
      } catch {
        // onclose will fire and trigger next scheduleReconnect
      }
    }, delay);
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const topicaWs = new TopicaWs();
