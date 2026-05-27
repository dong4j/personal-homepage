# WakaTime Activity Tracker

实时追踪 WakaTime 应用切换活动，通过 MQTT 消息队列实现跨设备数据推送。

## 架构

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   MBP       │         │   M2        │         │   Browser  │
│             │  MQTT   │             │  SSE     │             │
│ Publisher   │ ──────► │ Subscriber  │ ──────► │ 个人主页    │
└─────────────┘   :1883 └─────────────┘  :12840 └─────────────┘
```

- **Publisher**：MBP 本地运行，解析 `~/.wakatime/macos-wakatime.log`，通过 MQTT 推送到 M2
- **Subscriber (M2)**：部署在 M2 服务器，订阅 MQTT 并通过 SSE 推送给浏览器

## 组件

### Publisher (MBP)

解析本地日志文件，将应用切换事件发布到 MQTT 主题。

```
backend/
├── main.go          # Publisher 源码
└── wakatime-publisher  # 编译后的可执行文件
```

### Subscriber (M2)

部署在 M2 服务器，路径：`/Users/dong4j/Developer/Server/wakatime-sse`

## 部署步骤

### 1. M2 服务器 - Mosquitto (MQTT Broker)

```bash
# 安装
ssh m2 "/opt/homebrew/bin/brew install mosquitto"

# 配置
cat > /opt/homebrew/etc/mosquitto/mosquitto.conf << 'EOF'
allow_anonymous true
listener 1883
EOF

# brew services 管理
ssh m2 "brew services stop mosquitto 2>/dev/null; brew services start mosquitto"

# 开机自启（brew services 自动配置）
```

### 2. M2 服务器 - SSE 服务

```bash
# 编译
ssh m2 "export PATH=\$PATH:/opt/homebrew/bin && cd /Users/dong4j/Developer/Server/wakatime-sse && go build -o wakatime-sse ."

# PM2 管理
ssh m2 "pm2 start /Users/dong4j/Developer/Server/wakatime-sse/wakatime-sse --name wakatime-sse"

# 开机自启
ssh m2 "pm2 save"
```

### 3. MBP - Publisher

```bash
# 编译
cd backend
go build -o wakatime-publisher .

# PM2 管理
pm2 start ./wakatime-publisher --name wakatime-publisher

# 开机自启
pm2 save
```

## MQTT 配置

| 配置项 | 值 |
|--------|-----|
| Broker | `tcp://192.168.21.5:1883` |
| Topic | `wakatime/activity` |
| Client ID (Publisher) | `wakatime-publisher` |
| Client ID (Subscriber) | `wakatime-sse-subscriber` |

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

### MBP - Publisher

```bash
# 查看状态
pm2 list wakatime-publisher

# 重启
pm2 restart wakatime-publisher

# 查看日志
pm2 logs wakatime-publisher

# 停止
pm2 stop wakatime-publisher
```

### M2 - SSE 服务

```bash
# 查看状态
ssh m2 "pm2 list wakatime-sse"

# 重启
ssh m2 "pm2 restart wakatime-sse"

# 查看日志
ssh m2 "pm2 logs wakatime-sse"
```

### M2 - Mosquitto

```bash
# 查看状态
ssh m2 "brew services list | grep mosquitto"

# 重启
ssh m2 "brew services restart mosquitto"

# 查看日志
ssh m2 "cat ~/Library/Logs/mosquitto.log"
```
