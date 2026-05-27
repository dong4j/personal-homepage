# WakaTime SSE Server

订阅 MQTT 消息，通过 SSE 推送给浏览器，实现 WakaTime 活动实时展示。

## 功能

- 订阅 M2 本地 Mosquitto MQTT Broker 的 `wakatime/activity` 主题
- 接收 MBP 推送的应用切换事件
- 通过 Server-Sent Events (SSE) 推送给浏览器

## 依赖

- Go 1.21+
- Mosquitto (通过 `brew services` 管理)

## 编译

```bash
cd /Users/dong4j/Developer/Server/wakatime-sse
export PATH=$PATH:/opt/homebrew/bin
go mod tidy
go build -o wakatime-sse .
```

## PM2 管理

```bash
# 启动
pm2 start /Users/dong4j/Developer/Server/wakatime-sse/wakatime-sse --name wakatime-sse

# 查看状态
pm2 list wakatime-sse

# 重启
pm2 restart wakatime-sse

# 查看日志
pm2 logs wakatime-sse

# 停止
pm2 stop wakatime-sse

# 删除
pm2 delete wakatime-sse

# 开机自启
pm2 save
```

## API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/wakatime/stream` | SSE 实时流 |
| `GET /health` | 健康检查 |
| `GET /ping` | Ping 测试 |

## 数据格式

```json
{
  "from": "Finder",
  "to": "Visual Studio Code",
  "time": "2026-05-26 23:42:00"
}
```

## 进程管理

```bash
# 查看 SSE 端口占用
lsof -i :12840

# 查看 MQTT 端口占用
lsof -i :1883

# 重启 MQTT
brew services restart mosquitto
```
