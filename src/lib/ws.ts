import { invoke } from "@tauri-apps/api/core";

export type WsMessage = { type: string; [key: string]: unknown };
type MessageHandler = (msg: WsMessage) => void;

class TopicaWs {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];

  async connect(): Promise<void> {
    const port: number = await invoke("get_backend_port");
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    this.ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data as string);
      this.handlers.forEach((h) => h(msg));
    };

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () => reject(new Error("WebSocket connection failed"));
    });
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const topicaWs = new TopicaWs();
