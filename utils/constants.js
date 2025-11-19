/**
 * 项目常量配置文件
 * 统一管理所有常量定义
 */

const Constants = {
  // 应用配置
  APP: {
    VERSION: '2.0.0',
    NAME: '狼人杀桌游店',
    BUILD_DATE: '2024-12-19',
    CACHE_PREFIX: 'werewolf_store_'
  },

  // 存储键名
  STORAGE_KEYS: {
    USER_INFO: 'werewolf_store_userInfo',
    MEMBER_CARD: 'werewolf_store_memberCard',
    STORE_STATUS: 'werewolf_store_storeStatus',
    ACTIVITIES: 'werewolf_store_activities',
    MEMBERS: 'werewolf_store_members',
    TRANSACTIONS: 'werewolf_store_transactions',
    ADMIN_LIST: 'werewolf_store_adminList',
    USER_PREFERENCES: 'werewolf_store_preferences',
    CACHE_DATA: 'werewolf_store_cache'
  },

  // 网络配置
  NETWORK: {
    TIMEOUT: 10000,
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
    BASE_URL: 'https://api.example.com'
  },

  // 云函数配置
  CLOUD_FUNCTIONS: {
    USER_AUTH: 'userAuth',
    ACTIVITY_MANAGER: 'activityManager',
    TRANSACTION_MANAGER: 'transactionManager',
    STORE_MANAGER: 'storeManager'
  },

  // 用户角色
  USER_ROLES: {
    MEMBER: 'member',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super'
  },

  // 活动状态
  ACTIVITY_STATUS: {
    UPCOMING: 'upcoming',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  // 交易类型
  TRANSACTION_TYPES: {
    CONSUMPTION: 'consumption',
    RECHARGE: 'recharge',
    REFUND: 'refund',
    BONUS: 'bonus'
  },

  // 店铺状态
  STORE_STATUS: {
    OPEN: 'open',
    CLOSED: 'closed',
    BREAK_TIME: 'break_time'
  },

  // 页面路径
  ROUTES: {
    INDEX: '/pages/index/index',
    LOGIN: '/pages/login/login',
    MEMBER: '/pages/member/member',
    STORE_STATUS: '/pages/store-status/store-status',
    ACTIVITY: '/pages/activity/activity',
    ACTIVITY_LIST: '/pages/activity-list/activity-list',
    ADMIN_MANAGEMENT: '/pages/admin-management/admin-management'
  },

  // 动画时长（毫秒）
  ANIMATION: {
    FAST: 200,
    NORMAL: 300,
    SLOW: 500,
    EXTRA_SLOW: 800
  },

  // 表单验证规则
  VALIDATION: {
    PHONE_REGEX: /^1[3-9]\d{9}$/,
    PASSWORD_MIN_LENGTH: 6,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 20
  },

  // 业务常量
  BUSINESS: {
    DEFAULT_BALANCE: 0,
    MIN_RECHARGE_AMOUNT: 10,
    MAX_ACTIVITY_PARTICIPANTS: 20,
    DEFAULT_ACTIVITY_DURATION: 120, // 分钟
    SYNC_INTERVAL: 5 * 60 * 1000, // 5分钟
    CACHE_EXPIRE_TIME: 10 * 60 * 1000 // 10分钟
  },

  // 错误码
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_FAILED: 'AUTH_FAILED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DATA_NOT_FOUND: 'DATA_NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR'
  },

  // 提示信息
  MESSAGES: {
    LOGIN_SUCCESS: '登录成功',
    LOGIN_FAILED: '登录失败',
    SAVE_SUCCESS: '保存成功',
    SAVE_FAILED: '保存失败',
    DELETE_SUCCESS: '删除成功',
    DELETE_FAILED: '删除失败',
    NETWORK_ERROR: '网络连接失败',
    UNKNOWN_ERROR: '未知错误',
    PERMISSION_DENIED: '权限不足',
    DATA_NOT_FOUND: '数据不存在',
    VALIDATION_FAILED: '数据验证失败'
  },

  // 默认头像
  DEFAULT_AVATAR: '/images/default-avatar.png',

  // 图标配置
  ICONS: {
    HOME: 'images/home.png',
    HOME_ACTIVE: 'images/home-active.png',
    MEMBER: 'images/member.png',
    MEMBER_ACTIVE: 'images/member-active.png',
    ACTIVITY: 'images/activity.png',
    ACTIVITY_ACTIVE: 'images/activity-active.png'
  }
};

module.exports = Constants;
