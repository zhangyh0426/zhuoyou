# 狼人杀桌游店小程序 - 代码规范指南

## 1. 命名规范

### 1.1 文件命名
- **页面文件**: 使用 kebab-case (短横线分隔)
  - `pages/login/login.js`
  - `pages/shop-status/shop-status.js`
- **组件文件**: 使用 PascalCase (首字母大写)
  - `components/ShopStatus/index.js`
  - `components/UserCard/index.js`
- **工具文件**: 使用 camelCase (驼峰命名)
  - `utils/api.js`
  - `utils/cache.js`

### 1.2 变量命名
- **变量/函数**: 使用 camelCase
  ```javascript
  const userName = '张三';
  const getUserInfo = () => {};
  ```
- **常量**: 使用 UPPER_SNAKE_CASE
  ```javascript
  const API_BASE_URL = 'https://api.example.com';
  const MAX_RETRY_COUNT = 3;
  ```
- **类**: 使用 PascalCase
  ```javascript
  class UserManager {}
  class ShopService {}
  ```

### 1.3 微信小程序特定规范
- **data变量**: 使用 camelCase
  ```javascript
  data: {
    userInfo: null,
    shopStatus: 'open',
    currentActivity: {}
  }
  ```
- **事件处理**: 使用 handle 前缀
  ```javascript
  handleLogin() {},
  handleShopToggle() {},
  handleActivitySelect() {}
  ```

## 2. 注释规范

### 2.1 函数注释
```javascript
/**
 * 获取用户信息
 * @param {string} userId - 用户ID
 * @param {object} options - 选项配置
 * @returns {Promise<object>} 用户信息对象
 * @throws {Error} 当用户不存在时抛出错误
 */
async getUserInfo(userId, options = {}) {
  // 实现逻辑
}
```

### 2.2 组件注释
```javascript
/**
 * 用户信息卡片组件
 * 
 * @component
 * @example
 * <UserCard userInfo="{{userInfo}}" />
 */
Component({
  properties: {
    userInfo: {
      type: Object,
      value: {}
    }
  }
})
```

### 2.3 代码内注释
```javascript
// 单行注释使用双斜杠
const total = this.calculateTotal(); // 包含计算逻辑的注释

/**
 * 多行注释使用块注释
 * 描述复杂逻辑或算法
 */
function complexAlgorithm(data) {
  // ... 复杂实现
}
```

## 3. 代码结构规范

### 3.1 文件结构
```
pages/
├── index/
│   ├── index.js          // 页面逻辑
│   ├── index.wxml        // 页面结构
│   ├── index.wxss        // 页面样式
│   └── index.json        // 页面配置
components/
├── user-card/
│   ├── index.js          // 组件逻辑
│   ├── index.wxml        // 组件结构
│   ├── index.wxss        // 组件样式
│   └── index.json        // 组件配置
utils/
├── api.js                // API封装
├── cache.js              // 缓存管理
├── constants.js          // 常量定义
└── logger.js             // 日志系统
```

### 3.2 函数组织
```javascript
// 1. 导入模块
const { logger } = require('../../utils/logger');

// 2. 常量定义
const API_ENDPOINTS = {
  GET_USER_INFO: '/user/info'
};

// 3. 私有函数
function validateUserId(id) {
  // 验证逻辑
}

// 4. 公有函数
function getUserInfo(id) {
  // 主要逻辑
}

// 5. 导出
module.exports = {
  getUserInfo
};
```

### 3.3 页面组件结构
```javascript
// 页面文件结构示例
Page({
  // 数据定义
  data: {},

  // 生命周期
  onLoad(options) {},
  onShow() {},
  onReady() {},

  // 事件处理
  handleEvent() {},

  // 私有方法
  _privateMethod() {},

  // 数据获取
  fetchData() {},

  // 工具方法
  formatData() {}
});
```

## 4. 错误处理规范

### 4.1 异步错误处理
```javascript
// 好的实践
async function fetchUserData() {
  try {
    const result = await wx.request({
      url: 'https://api.example.com/user'
    });
    return result.data;
  } catch (error) {
    logger.error('Failed to fetch user data:', error);
    globalErrorHandler.reportError(error, { context: 'fetchUserData' });
    throw error;
  }
}
```

### 4.2 数据验证
```javascript
// 好的实践
function validateUserInput(data) {
  const required = ['name', 'phone', 'email'];
  
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // 格式验证
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(data.phone)) {
    throw new Error('Invalid phone number format');
  }
}
```

## 5. 性能优化规范

### 5.1 内存管理
```javascript
// 及时清理定时器
onUnload() {
  clearInterval(this.timer);
  clearTimeout(this.timeout);
}

// 适当缓存数据
const cache = new Map();

function getCachedData(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  // ... 获取数据逻辑
}
```

### 5.2 数据处理
```javascript
// 使用防抖
const debouncedSearch = this.debounce(this.handleSearch, 300);

// 使用节流
const throttledScroll = this.throttle(this.handleScroll, 100);

// 分页加载
function loadMoreData(page = 1) {
  if (this.isLoading) return;
  
  this.setData({ isLoading: true });
  
  // 获取数据逻辑
}
```

## 6. 样式规范

### 6.1 类名命名
- 使用 BEM 命名方法
- 组件: `component-name__element--modifier`
- 示例: `user-card__avatar--large`

### 6.2 样式组织
```css
/* 全局样式变量 */
:root {
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --danger-color: #f5222d;
}

/* 组件样式 */
.user-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.user-card__header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.user-card__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.user-card__avatar--large {
  width: 64px;
  height: 64px;
}

/* 响应式设计 */
@media (max-width: 320px) {
  .user-card {
    padding: 12px;
  }
}
```

## 7. 测试规范

### 7.1 单元测试
```javascript
// utils/math.spec.js
const { add } = require('./math');

describe('Math utility functions', () => {
  test('add function works correctly', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });
});
```

### 7.2 集成测试
```javascript
// 测试页面功能
Page({
  test() {
    // 模拟用户操作
    this.handleLogin();
    
    // 验证结果
    expect(this.data.isLoggedIn).toBe(true);
  }
});
```

## 8. Git 提交规范

### 8.1 提交信息格式
```
type(scope): subject

body

footer
```

### 8.2 类型说明
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 样式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 8.3 提交示例
```
feat(login): 添加用户登录功能

实现用户登录功能，包括：
- 验证用户凭证
- 缓存登录状态
- 错误处理机制

Close #123
```

## 9. 微信小程序特定规范

### 9.1 数据绑定
```javascript
// 好的实践
data: {
  userList: [],  // 使用复数形式表示数组
  userCount: 0,  // 使用count表示数量
  isLoading: false  // 使用is前缀表示布尔值
}
```

### 9.2 事件处理
```javascript
// 好的实践
Page({
  // 命名约定：handle + 动词
  handleButtonTap() {
    console.log('Button tapped');
  },
  
  handleFormSubmit(e) {
    const { detail } = e;
    this.processFormData(detail);
  }
})
```

### 9.3 生命周期使用
```javascript
// 好的实践
Page({
  onLoad(options) {
    // 页面加载时获取参数
    this.pageId = options.id;
    this.initPage();
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData();
  },

  onHide() {
    // 页面隐藏时暂停操作
    this.pauseOperations();
  },

  onUnload() {
    // 页面卸载时清理资源
    this.cleanup();
  }
})
```

## 10. 最佳实践检查清单

### 10.1 代码质量
- [ ] 使用 ESLint 检查代码规范
- [ ] 添加必要的注释
- [ ] 错误处理完善
- [ ] 性能优化到位

### 10.2 功能实现
- [ ] 功能测试完整
- [ ] 边界情况处理
- [ ] 用户体验优化
- [ ] 安全性检查

### 10.3 微信小程序特性
- [ ] 适配不同屏幕尺寸
- [ ] 优化首屏加载时间
- [ ] 合理使用分包
- [ ] 遵守平台规范

---

## 工具和配置

### ESLint 配置示例
```json
{
  "extends": ["eslint:recommended"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Prettier 配置示例
```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```