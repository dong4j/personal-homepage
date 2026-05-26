package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

const port = 12840

type AppChange struct {
	From string `json:"from"`
	To   string `json:"to"`
	Time string `json:"time"`
}

type SSEClient struct {
	ch chan string
}

var (
	clients   = make(map[*SSEClient]bool)
	clientsMu sync.Mutex
)

func main() {
	log.Printf("Starting wakatime SSE server on :%d", port)

	http.HandleFunc("/api/wakatime/stream", handleSSE)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ping", handlePing)

	go watchLog()

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
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

var appChangeRegex = regexp.MustCompile(`(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*App changed from (.+) to (.+?) \(`)

func handleLine(line string) {
	matches := appChangeRegex.FindStringSubmatch(line)
	if len(matches) >= 4 {
		app := AppChange{
			From: strings.TrimSpace(matches[2]),
			To:   strings.TrimSpace(matches[3]),
			Time: matches[1],
		}
		broadcast(app)
	}
}

func broadcast(app AppChange) {
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
