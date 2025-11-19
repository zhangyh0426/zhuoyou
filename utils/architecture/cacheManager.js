// 缓存管理器 - 统一缓存系统
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0
    };
    this.defaultTTL = 5 * 60 * 1000; // 5分钟
    this.cleanupInterval = 60 * 1000; // 1分钟清理一次
    this.maxSize = 1000; // 最大缓存数量
    
    this.startCleanupTimer();
  }

  // 启动清理定时器
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  // 停止清理定时器
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // 生成缓存键
  generateKey(key, namespace = 'default') {
    return `${namespace}:${key}`;
  }

  // 设置缓存
  set(key, value, ttl = this.defaultTTL, namespace = 'default') {
    const cacheKey = this.generateKey(key, namespace);
    const expiryTime = Date.now() + ttl;

    // 检查缓存大小限制
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, {
      value,
      createdAt: Date.now(),
      accessCount: 0
    });
    
    this.ttl.set(cacheKey, expiryTime);
    this.stats.sets++;

    logger.debug(`缓存设置: ${cacheKey}`, { ttl, namespace });
  }

  // 获取缓存
  get(key, namespace = 'default') {
    const cacheKey = this.generateKey(key, namespace);
    const cacheEntry = this.cache.get(cacheKey);
    const expiryTime = this.ttl.get(cacheKey);

    if (!cacheEntry || !expiryTime) {
      this.stats.misses++;
      logger.debug(`缓存未命中: ${cacheKey}`);
      return null;
    }

    // 检查是否过期
    if (Date.now() > expiryTime) {
      this.delete(key, namespace);
      this.stats.misses++;
      logger.debug(`缓存过期: ${cacheKey}`);
      return null;
    }

    // 更新访问统计
    cacheEntry.accessCount++;
    cacheEntry.lastAccessed = Date.now();
    this.stats.hits++;

    logger.debug(`缓存命中: ${cacheKey}`, { 
      accessCount: cacheEntry.accessCount,
      age: Date.now() - cacheEntry.createdAt 
    });

    return cacheEntry.value;
  }

  // 删除缓存
  delete(key, namespace = 'default') {
    const cacheKey = this.generateKey(key, namespace);
    const deleted = this.cache.delete(cacheKey);
    this.ttl.delete(cacheKey);
    
    if (deleted) {
      this.stats.deletes++;
      logger.debug(`缓存删除: ${cacheKey}`);
    }
    
    return deleted;
  }

  // 清空缓存
  clear(namespace = null) {
    if (namespace) {
      // 清空指定命名空间
      const prefix = `${namespace}:`;
      const keysToDelete = [];
      
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.ttl.delete(key);
      });
      
      this.stats.clears++;
      logger.info(`清空命名空间缓存: ${namespace}`, { deletedCount: keysToDelete.length });
    } else {
      // 清空所有缓存
      const size = this.cache.size;
      this.cache.clear();
      this.ttl.clear();
      this.stats.clears++;
      logger.info(`清空所有缓存`, { deletedCount: size });
    }
  }

  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, expiryTime] of this.ttl) {
      if (now > expiryTime) {
        this.cache.delete(key);
        this.ttl.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`清理过期缓存`, { cleanedCount: cleaned });
    }
  }

  // 淘汰最久未使用的缓存
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, cacheEntry] of this.cache) {
      const lastAccessed = cacheEntry.lastAccessed || cacheEntry.createdAt;
      if (lastAccessed < oldestTime) {
        oldestTime = lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.ttl.delete(oldestKey);
      logger.debug(`淘汰最久未使用缓存: ${oldestKey}`);
    }
  }

  // 检查键是否存在
  has(key, namespace = 'default') {
    const cacheKey = this.generateKey(key, namespace);
    return this.cache.has(cacheKey) && !this.isExpired(cacheKey);
  }

  // 检查是否过期
  isExpired(cacheKey) {
    const expiryTime = this.ttl.get(cacheKey);
    return !expiryTime || Date.now() > expiryTime;
  }

  // 获取统计信息
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // 获取内存使用情况（估算）
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, cacheEntry] of this.cache) {
      totalSize += this.estimateSize(key);
      totalSize += this.estimateSize(cacheEntry);
    }

    return {
      bytes: totalSize,
      readable: this.formatBytes(totalSize)
    };
  }

  // 估算对象大小
  estimateSize(obj) {
    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16 估算
    } else if (typeof obj === 'number') {
      return 8;
    } else if (typeof obj === 'boolean') {
      return 4;
    } else if (obj === null || obj === undefined) {
      return 0;
    } else if (Array.isArray(obj)) {
      return obj.reduce((total, item) => total + this.estimateSize(item), 0);
    } else if (typeof obj === 'object') {
      return Object.keys(obj).reduce((total, key) => {
        return total + this.estimateSize(key) + this.estimateSize(obj[key]);
      }, 0);
    }
    
    return 16; // 默认估算
  }

  // 格式化字节数
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 重置统计
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0
    };
  }

  // 获取所有键
  getKeys(namespace = 'default') {
    const prefix = `${namespace}:`;
    const keys = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    
    return keys;
  }

  // 获取缓存信息
  getCacheInfo(key, namespace = 'default') {
    const cacheKey = this.generateKey(key, namespace);
    const cacheEntry = this.cache.get(cacheKey);
    const expiryTime = this.ttl.get(cacheKey);

    if (!cacheEntry || !expiryTime) {
      return null;
    }

    return {
      key,
      namespace,
      createdAt: cacheEntry.createdAt,
      lastAccessed: cacheEntry.lastAccessed || cacheEntry.createdAt,
      accessCount: cacheEntry.accessCount,
      expiresIn: expiryTime - Date.now(),
      isExpired: Date.now() > expiryTime
    };
  }

  // 销毁缓存管理器
  destroy() {
    this.stopCleanupTimer();
    this.clear();
    this.resetStats();
    logger.info('缓存管理器已销毁');
  }
}

// 单例模式
let cacheManager = null;

function getCacheManager() {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}

module.exports = {
  CacheManager,
  getCacheManager
};