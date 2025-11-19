// 日志管理器 - 统一日志系统
class Logger {
  constructor() {
    this.logLevel = 'info'; // debug, info, warn, error
    this.logs = [];
    this.maxLogs = 1000;
    this.enableConsole = true;
    this.enableStorage = false;
    this.storageKey = 'app_logs';
  }

  // 设置日志级别
  setLevel(level) {
    this.logLevel = level;
  }

  // 启用存储
  enableStorageLogging() {
    this.enableStorage = true;
  }

  // 日志级别权重
  getLevelWeight(level) {
    const weights = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return weights[level] || 0;
  }

  // 格式化日志
  formatLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || null,
      stack: level === 'error' ? new Error().stack : null
    };

    return logEntry;
  }

  // 输出到控制台
  outputToConsole(logEntry) {
    if (!this.enableConsole) return;

    const { timestamp, level, message, data } = logEntry;
    const output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'debug':
        console.log(output, data || '');
        break;
      case 'info':
        console.info(output, data || '');
        break;
      case 'warn':
        console.warn(output, data || '');
        break;
      case 'error':
        console.error(output, data || '');
        break;
      default:
        console.log(output, data || '');
    }
  }

  // 存储到本地
  saveToStorage(logEntry) {
    if (!this.enableStorage) return;

    try {
      this.logs.push(logEntry);
      
      // 限制日志数量
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      // 异步存储到本地
      wx.setStorage({
        key: this.storageKey,
        data: JSON.stringify(this.logs)
      });
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }

  // 记录日志
  log(level, message, data) {
    if (this.getLevelWeight(level) < this.getLevelWeight(this.logLevel)) {
      return;
    }

    const logEntry = this.formatLog(level, message, data);
    
    this.outputToConsole(logEntry);
    this.saveToStorage(logEntry);
  }

  // 调试日志
  debug(message, data) {
    this.log('debug', message, data);
  }

  // 信息日志
  info(message, data) {
    this.log('info', message, data);
  }

  // 警告日志
  warn(message, data) {
    this.log('warn', message, data);
  }

  // 错误日志
  error(message, data) {
    this.log('error', message, data);
  }

  // 获取日志
  getLogs(level, limit = 100) {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    return filteredLogs.slice(-limit);
  }

  // 清空日志
  clearLogs() {
    this.logs = [];
    wx.removeStorage({ key: this.storageKey });
  }

  // 导出日志
  exportLogs() {
    return {
      exportTime: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs
    };
  }

  // 性能监控
  performanceStart(label) {
    if (this.getLevelWeight('debug') < this.getLevelWeight(this.logLevel)) {
      return;
    }

    console.time(label);
  }

  performanceEnd(label) {
    if (this.getLevelWeight('debug') < this.getLevelWeight(this.logLevel)) {
      return;
    }

    console.timeEnd(label);
  }
}

// 全局日志实例
const logger = new Logger();

// 错误处理包装器
function errorHandler(fn, context = '') {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      logger.error(`${context} 执行失败:`, {
        error: error.message,
        stack: error.stack,
        args: args
      });
      throw error;
    }
  };
}

// 性能监控包装器
function performanceMonitor(fn, name) {
  return async function(...args) {
    const startTime = Date.now();
    logger.performanceStart(`${name} - 性能监控`);
    
    try {
      const result = await fn.apply(this, args);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.info(`${name} 执行完成`, {
        duration: `${duration}ms`,
        success: true
      });
      
      logger.performanceEnd(`${name} - 性能监控`);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.error(`${name} 执行失败`, {
        duration: `${duration}ms`,
        error: error.message
      });
      
      logger.performanceEnd(`${name} - 性能监控`);
      throw error;
    }
  };
}

// 单例模式获取日志器
function getLogger() {
  return logger;
}

module.exports = {
  Logger,
  logger,
  getLogger,
  errorHandler,
  performanceMonitor
};