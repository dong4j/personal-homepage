package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

/**
 * WakaTime Activity Publisher
 *
 * 功能：解析本地 WakaTime 日志，通过 MQTT 协议将活动事件发布到远程服务器
 * 部署：运行在 MBP 上
 */

const (
	// MQTT 配置 - M2 服务器地址
	mqttBroker     = "tcp://192.168.31.5:1883"
	mqttTopic      = "wakatime/activity"
	mqttTokenTopic = "tokentracker/token-usage" // Token 用量 topic
	mqttClientID   = "wakatime-publisher"

	// Token 数据文件路径
	tokenQueuePath = "/Users/dong4j/.tokentracker/tracker/queue.jsonl"

	// Token 推送间隔
	tokenPublishInterval = 30 * time.Second
)

// TokenUsage Token 用量数据
type TokenUsage struct {
	Date        string `json:"date"`         // 北京日期 YYYY-MM-DD
	TotalTokens int64  `json:"total_tokens"` // 今日总 token 数
	Time        string `json:"time"`         // 发布时间
}

type AppChange struct {
	From string `json:"from"`
	To   string `json:"to"`
	Time string `json:"time"`
}

var (
	mqttClient     mqtt.Client
	appChangeRegex = regexp.MustCompile(`(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*App changed from (.+) to (.+?) \(`)
)

func main() {
	log.Printf("Starting WakaTime Activity Publisher")
	log.Printf("MQTT Broker: %s", mqttBroker)
	log.Printf("Topic: %s", mqttTopic)

	// 连接 MQTT
	opts := mqtt.NewClientOptions()
	opts.AddBroker(mqttBroker)
	opts.SetClientID(mqttClientID)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)

	mqttClient = mqtt.NewClient(opts)

	token := mqttClient.Connect()
	if token.Wait() && token.Error() != nil {
		log.Fatalf("Failed to connect to MQTT: %v", token.Error())
	}
	log.Println("Connected to MQTT broker")

	// 启动日志监控
	go watchLog()

	// 启动 Token 用量定时推送
	go publishTokenUsageLoop()

	// 保持运行
	select {}
}

func watchLog() {
	logPath := "/Users/dong4j/.wakatime/macos-wakatime.log"

	file, err := openFile(logPath)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	defer file.Close()

	reader := bufio.NewReader(file)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}
		handleLine(line)
	}
}

func handleLine(line string) {
	matches := appChangeRegex.FindStringSubmatch(line)
	if len(matches) >= 4 {
		app := AppChange{
			From: strings.TrimSpace(matches[2]),
			To:   strings.TrimSpace(matches[3]),
			Time: matches[1],
		}
		publishAppChange(app)
	}
}

func publishAppChange(app AppChange) {
	data, err := json.Marshal(app)
	if err != nil {
		log.Printf("Failed to marshal app change: %v", err)
		return
	}

	token := mqttClient.Publish(mqttTopic, 0, false, data)
	if token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish: %v", token.Error())
		return
	}

	log.Printf("Published: %s → %s", app.From, app.To)
}

func openFile(path string) (*os.File, error) {
	for i := 0; i < 10; i++ {
		file, err := os.Open(path)
		if err == nil {
			file.Seek(0, 2)
			return file, nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return nil, fmt.Errorf("failed to open file after 10 attempts")
}

// publishTokenUsageLoop 每 30 分钟读取 queue.jsonl 并推送 Token 用量
func publishTokenUsageLoop() {
	// 立即执行一次
	publishTokenUsage()

	ticker := time.NewTicker(tokenPublishInterval)
	defer ticker.Stop()

	for range ticker.C {
		publishTokenUsage()
	}
}

// publishTokenUsage 读取 queue.jsonl 并推送今日 Token 用量
func publishTokenUsage() {
	// 加载北京时间时区
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		log.Printf("Failed to load Asia/Shanghai timezone: %v", err)
		return
	}

	// 获取北京时间今日日期
	now := time.Now().In(loc)
	today := now.Format("2006-01-02")

	// 读取 queue.jsonl
	file, err := os.Open(tokenQueuePath)
	if err != nil {
		log.Printf("Failed to open queue file: %v", err)
		return
	}
	defer file.Close()

	// 用于去重：每个 (source, model, hour_start) 只取最后一个值
	seen := make(map[string]map[string]interface{})
	// key: "source|model|hour_start"
	// value: map containing the row

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var row map[string]interface{}
		if err := json.Unmarshal(line, &row); err != nil {
			continue
		}

		hourStart, ok := row["hour_start"].(string)
		if !ok || hourStart == "" {
			continue
		}

		// 解析 UTC 时间
		utcTime, err := time.Parse(time.RFC3339, hourStart)
		if err != nil {
			continue
		}

		// 转换为北京时间
		localTime := utcTime.In(loc)
		localDay := localTime.Format("2006-01-02")

		// 只统计今日数据
		if localDay != today {
			continue
		}

		source, _ := row["source"].(string)
		model, _ := row["model"].(string)
		key := source + "|" + model + "|" + hourStart

		seen[key] = row
	}

	// 累加今日所有去重后的 total_tokens
	var totalTokens int64
	for _, row := range seen {
		if totalTokensRaw, ok := row["total_tokens"].(float64); ok {
			totalTokens += int64(totalTokensRaw)
		}
	}

	// 推送 MQTT
	usage := TokenUsage{
		Date:        today,
		TotalTokens: totalTokens,
		Time:        now.Format("15:04:05"),
	}

	data, err := json.Marshal(usage)
	if err != nil {
		log.Printf("Failed to marshal token usage: %v", err)
		return
	}

	token := mqttClient.Publish(mqttTokenTopic, 0, false, data)
	if token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish token usage: %v", token.Error())
		return
	}

	log.Printf("Published token usage: date=%s, total=%d", usage.Date, usage.TotalTokens)
}
