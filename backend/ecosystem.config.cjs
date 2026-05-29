module.exports = {
  apps: [
    {
      name: "wakatime-publisher",

      cwd: "/Users/dong4j/Developer/3.Knowledge/Site/hexo/dependencies/personal-page/backend",
      script: "./wakatime-publisher",

      exec_mode: "fork",
      interpreter: "none",

      autorestart: true,
      watch: false,

      restart_delay: 5000,

      out_file: "/Users/dong4j/.pm2/logs/wakatime-publisher-out.log",
      error_file: "/Users/dong4j/.pm2/logs/wakatime-publisher-error.log",
      merge_logs: true,
      time: true,

      env: {
        HOME: "/Users/dong4j",
        PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        MQTT_BROKER: "tcp://192.168.31.5:1883"
      }
    }
  ]
}