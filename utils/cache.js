/**
 * 数据缓存管理器
 * 提供高效的数据缓存、过期管理和存储优化
 */

const Constants = require('./constants');
const { logger } = require('./logger');

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = Constants.BUSINESS.CACHE_EXPIRE_TIME;
    this.maxCacheSize = 100; // 最大缓存项数
    this.cleanupInterval = null;

    this.initCleanupTimer();
    this.loadPersistentCache();
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} data - 缓存数据
   * @param {number} ttl - 过期时间（毫秒）
   */
  set(key, data, ttl = this.defaultTTL) {
    try {
      // 检查缓存大小限制
      if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
        this.evictOldest();
      }

      const cacheItem = {
        data,
        timestamp: Date.now(),
        ttl,
        accessCount: 1,
        lastAccess: Date.now()
      };

      this.cache.set(key, cacheItem);

      // 持久化重要数据
      if (this.shouldPersist(key)) {
        this.persistKey(key, data);
      }

      logger.debug(`Cache set: ${key}`, { ttl, dataSize: JSON.stringify(data).length });
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @param {any} defaultValue - 默认值
   */
  get(key, defaultValue = null) {
    try {
      const item = this.cache.get(key);

      if (!item) {
        // 尝试从持久化存储获取
        const persistedData = this.getPersistentKey(key);
        if (persistedData) {
          this.set(key, persistedData); // 重新放入内存缓存
          return persistedData;
        }
        return defaultValue;
      }

      // 检查是否过期
      if (this.isExpired(item)) {
        this.delete(key);
        return defaultValue;
      }

      // 更新访问统计
      item.accessCount++;
      item.lastAccess = Date.now();

      logger.debug(`Cache hit: ${key}`, { accessCount: item.accessCount });
      return item.data;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param {string} key - 缓存键
   */
  has(key) {
    const item = this.cache.get(key);
    return item && !this.isExpired(item);
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    try {
      this.cache.delete(key);
      this.deletePersistentKey(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    try {
      this.cache.clear();
      this.clearPersistentCache();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const stats = {
      totalItems: this.cache.size,
      memoryUsage: 0,
      averageAccessCount: 0,
      oldestItem: null,
      mostAccessed: null
    };

    if (this.cache.size === 0) return stats;

    let totalAccess = 0;
    let oldestTime = Date.now();
    let mostAccessedCount = 0;

    this.cache.forEach((item, key) => {
      // 计算内存使用量
      stats.memoryUsage += JSON.stringify(item).length;

      // 访问统计
      totalAccess += item.accessCount;

      // 找出最久未访问的项目
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        stats.oldestItem = key;
      }

      // 找出访问最多的项目
      if (item.accessCount > mostAccessedCount) {
        mostAccessedCount = item.accessCount;
        stats.mostAccessed = key;
      }
    });

    stats.averageAccessCount = totalAccess / this.cache.size;
    stats.memoryUsage = `${Math.round(stats.memoryUsage / 1024)} KB`;

    return stats;
  }

  /**
   * 检查项目是否过期
   * @private
   */
  isExpired(item) {
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * 清理过期项目
   */
  cleanup() {
    let cleanedCount = 0;
    const now = Date.now();

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        this.deletePersistentKey(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cache cleanup: removed ${cleanedCount} expired items`);
    }
  }

  /**
   * 初始化清理定时器
   * @private
   */
  initCleanupTimer() {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 淘汰最久未访问的项目
   * @private
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    this.cache.forEach((item, key) => {
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.delete(oldestKey);
      logger.debug(`Cache eviction: removed ${oldestKey}`);
    }
  }

  /**
   * 判断是否应该持久化
   * @private
   */
  shouldPersist(key) {
    const persistentKeys = [
      Constants.STORAGE_KEYS.USER_INFO,
      Constants.STORAGE_KEYS.MEMBER_CARD,
      Constants.STORAGE_KEYS.STORE_STATUS,
      Constants.STORAGE_KEYS.ADMIN_LIST
    ];
    return persistentKeys.includes(key);
  }

  /**
   * 持久化存储
   * @private
   */
  persistKey(key, data) {
    try {
      wx.setStorageSync(`${Constants.APP.CACHE_PREFIX}persistent_${key}`, {
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`Failed to persist key ${key}:`, error);
    }
  }

  /**
   * 获取持久化数据
   * @private
   */
  getPersistentKey(key) {
    try {
      const stored = wx.getStorageSync(`${Constants.APP.CACHE_PREFIX}persistent_${key}`);
      if (stored && !this.isExpired(stored)) {
        return stored.data;
      }
      // 清理过期数据
      this.deletePersistentKey(key);
      return null;
    } catch (error) {
      logger.error(`Failed to get persistent key ${key}:`, error);
      return null;
    }
  }

  /**
   * 删除持久化数据
   * @private
   */
  deletePersistentKey(key) {
    try {
      wx.removeStorageSync(`${Constants.APP.CACHE_PREFIX}persistent_${key}`);
    } catch (error) {
      logger.error(`Failed to delete persistent key ${key}:`, error);
    }
  }

  /**
   * 加载持久化缓存
   * @private
   */
  loadPersistentCache() {
    try {
      const keys = Object.values(Constants.STORAGE_KEYS);
      let loadedCount = 0;

      keys.forEach(key => {
        const persisted = this.getPersistentKey(key);
        if (persisted) {
          this.cache.set(key, {
            data: persisted,
            timestamp: Date.now(),
            ttl: this.defaultTTL,
            accessCount: 1,
            lastAccess: Date.now()
          });
          loadedCount++;
        }
      });

      if (loadedCount > 0) {
        logger.info(`Cache loaded: ${loadedCount} persistent items`);
      }
    } catch (error) {
      logger.error('Failed to load persistent cache:', error);
    }
  }

  /**
   * 清空持久化缓存
   * @private
   */
  clearPersistentCache() {
    try {
      const keys = Object.values(Constants.STORAGE_KEYS);
      keys.forEach(key => {
        this.deletePersistentKey(key);
      });
    } catch (error) {
      logger.error('Failed to clear persistent cache:', error);
    }
  }

  /**
   * 预加载缓存
   */
  preload(keys) {
    keys.forEach(key => {
      if (!this.has(key)) {
        // 这里可以触发数据预加载
        logger.debug(`Preload cache: ${key}`);
      }
    });
  }

  /**
   * 缓存版本管理
   */
  invalidateVersion(version) {
    const versionKey = `${Constants.APP.CACHE_PREFIX}version`;
    const currentVersion = wx.getStorageSync(versionKey);

    if (currentVersion !== version) {
      this.clear();
      wx.setStorageSync(versionKey, version);
      logger.info(`Cache invalidated for version ${version}`);
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// 创建全局缓存管理器实例
const cacheManager = new CacheManager();

module.exports = {
  cacheManager,
  CacheManager
};
