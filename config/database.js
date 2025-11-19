// 云数据库配置文件
// config/database.js

module.exports = {
  // 数据库配置
  database: {
    host: 'mysql2.sqlpub.com',
    port: 3307,
    user: 'simon0426',
    password: 'mDsZsr1j6lTyZdrN',
    database: 'zhuoyou',
    charset: 'utf8mb4',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  },

  // 云函数API基础URL（需要配置云函数）
  apiBaseUrl: 'https://your-cloud-function-url.com/api',

  // 数据同步配置
  sync: {
    autoSync: true,        // 自动同步开关
    syncInterval: 30000,   // 同步间隔（毫秒）
    batchSize: 100,        // 批量处理大小
    retryTimes: 3,         // 重试次数
    retryDelay: 2000       // 重试延迟（毫秒）
  },

  // 本地缓存配置
  cache: {
    ttl: 300000,           // 缓存生存时间（毫秒）
    maxSize: 1000          // 最大缓存条目数
  },

  // 离线模式配置
  offline: {
    enabled: true,         // 启用离线模式
    syncOnConnect: true,   // 连接时自动同步
    queueSize: 500         // 离线队列最大大小
  }
};
