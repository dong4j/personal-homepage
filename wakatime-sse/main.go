package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

/**
 * WakaTime SSE Server
 *
 * 功能：订阅 MQTT 消息，通过 SSE 推送给浏览器
 * 部署：运行在 M2 服务器上
 */

const (
	// MQTT 配置
	mqttBroker      = "tcp://localhost:1883"
	mqttTopic       = "wakatime/activity"
	mqttTokenTopic  = "tokentracker/token-usage"
	mqttClientID    = "wakatime-sse-subscriber"

	// SSE 服务端口
	port = 12840
)

type AppChange struct {
	From string `json:"from"`
	To   string `json:"to"`
	Time string `json:"time"`
}

type TokenUsage struct {
	Date        string `json:"date"`
	TotalTokens int64  `json:"total_tokens"`
	Time        string `json:"time"`
}

type SSEClient struct {
	ch chan string
}

var (
	clients   = make(map[*SSEClient]bool)
	clientsMu sync.Mutex
)

func main() {
	log.Printf("Starting WakaTime SSE Server on :%d", port)
	log.Printf("MQTT Broker: %s", mqttBroker)
	log.Printf("Topic: %s", mqttTopic)
	log.Printf("Token Topic: %s", mqttTokenTopic)

	// 连接 MQTT
	opts := mqtt.NewClientOptions()
	opts.AddBroker(mqttBroker)
	opts.SetClientID(mqttClientID)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)
	opts.SetDefaultPublishHandler(messageHandler)

	mqttClient := mqtt.NewClient(opts)
	token := mqttClient.Connect()
	if token.Wait() && token.Error() != nil {
		log.Fatalf("Failed to connect to MQTT: %v", token.Error())
	}
	log.Println("Connected to MQTT broker")

	// 订阅 wakatime 活动主题
	token = mqttClient.Subscribe(mqttTopic, 0, nil)
	if token.Wait() && token.Error() != nil {
		log.Fatalf("Failed to subscribe: %v", token.Error())
	}
	log.Printf("Subscribed to topic: %s", mqttTopic)

	// 订阅 token 用量主题
	token = mqttClient.Subscribe(mqttTokenTopic, 0, tokenUsageHandler)
	if token.Wait() && token.Error() != nil {
		log.Fatalf("Failed to subscribe token topic: %v", token.Error())
	}
	log.Printf("Subscribed to token topic: %s", mqttTokenTopic)

	// 启动 HTTP 服务
	http.HandleFunc("/api/wakatime/stream", handleSSE)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ping", handlePing)

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}

var messageHandler mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
	var app AppChange
	if err := json.Unmarshal(msg.Payload(), &app); err != nil {
		log.Printf("Failed to unmarshal message: %v", err)
		return
	}
	broadcastAppChange(app)
}

var tokenUsageHandler mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
	var usage TokenUsage
	if err := json.Unmarshal(msg.Payload(), &usage); err != nil {
		log.Printf("Failed to unmarshal token usage: %v", err)
		return
	}
	broadcastTokenUsage(usage)
}

func handleSSE(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		client := &SSEClient{ch: make(chan string, 256)}
		clientsMu.Lock()
		clients[client] = true
		clientsMu.Unlock()

		defer func() {
			clientsMu.Lock()
			delete(clients, client)
			clientsMu.Unlock()
		}()

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			return
		}

		for msg := range client.ch {
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		}
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "OK")
}

func handlePing(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "pong")
}

func broadcastAppChange(app AppChange) {
	data, _ := json.Marshal(app)
	msg := string(data)

	clientsMu.Lock()
	for client := range clients {
		select {
		case client.ch <- msg:
		default:
			close(client.ch)
			delete(clients, client)
		}
	}
	clientsMu.Unlock()

	log.Printf("Broadcast: %s → %s", app.From, app.To)
}

func broadcastTokenUsage(usage TokenUsage) {
	data, _ := json.Marshal(usage)
	msg := string(data)

	clientsMu.Lock()
	for client := range clients {
		select {
		case client.ch <- msg:
		default:
			close(client.ch)
			delete(clients, client)
		}
	}
	clientsMu.Unlock()

	log.Printf("Broadcast Token Usage: date=%s, total=%d", usage.Date, usage.TotalTokens)
}
