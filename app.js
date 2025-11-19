// app.js
// 微信小程序：数据库管理工具
// 注意：微信小程序不支持 CommonJS 的 require，这里需要特殊处理

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    isAdmin: false,
    memberCard: null,
    storeStatus: {
      isOpen: false,
      openTime: '',
      closeTime: '',
      lastUpdate: ''
    },
    currentActivity: null,
    // 云数据库相关
    dbManager: null,
    isCloudConnected: false,
    syncInProgress: false,
    // 微信小程序特定
    isMiniProgram: true
  },

  async onLaunch() {
    try {
      console.log('应用启动，正在初始化...');

      // 初始化云数据库连接（微信小程序方式）
      await this.initCloudDatabaseMiniProgram();

      // 初始化本地存储数据
      this.initLocalData();

      // 初始化默认管理员数据
      this.initDefaultAdmin();

      // 检查登录状态
      await this.checkLoginStatus();

      // 启动数据同步
      this.startDataSync();

      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      // 即使云数据库连接失败，也要继续运行应用
    }
  },

  // 初始化云数据库连接（微信小程序方式）
  async initCloudDatabaseMiniProgram() {
    try {
      // 检查云函数环境
      if (wx.cloud) {
        // 使用微信云开发云函数
        console.log('检测到微信云开发环境');
        
        // 初始化云开发环境
        await wx.cloud.init({
          env: 'cloud1-2gq89p31220bb320', // 使用您提供的环境ID
          traceUser: true
        });
        
        console.log('✅ 微信云开发环境初始化成功');
        this.globalData.isCloudConnected = true;

        // 初始化云函数调用
        this.initCloudFunctions();
        
        // 测试数据库连接
        await this.testCloudDatabase();
        
        // 通过云函数创建集合
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: {
            action: 'createCollections',
            data: {
              collections: [
                { name: 'users' },
                { name: 'member_cards' },
                { name: 'transactions' },
                { name: 'activities' },
                { name: 'activity_participants' },
                { name: 'store_status' },
                { name: 'admins' }
              ]
            }
          }
        });
        
        if (!result.result.success) {
          throw new Error('创建集合失败: ' + result.result.error);
        }
        
        console.log('✅ 云数据库集合创建成功');
      } else {
        // 使用本地存储模式
        console.log('未检测到微信云开发，使用本地存储模式');
        this.globalData.isCloudConnected = false;
      }
    } catch (error) {
      console.error('云数据库初始化失败:', error);
      this.globalData.isCloudConnected = false;
    }
  },

  // 测试云数据库连接
  async testCloudDatabase() {
    try {
      const db = wx.cloud.database();
      const result = await db.collection('users').limit(1).get();
      console.log('✅ 云数据库连接测试成功');
    } catch (error) {
      console.warn('⚠️ 云数据库连接测试失败:', error.message);
      // 如果集合不存在，尝试创建
      try {
        console.log('尝试创建数据库集合...');
        await this.createCloudCollections();
      } catch (createError) {
        console.error('创建集合失败:', createError);
      }
    }
  },

  // 创建云数据库集合
  async createCloudCollections() {
    try {
      const collections = [
        { name: 'users', description: '用户数据' },
        { name: 'member_cards', description: '会员卡数据' },
        { name: 'transactions', description: '交易记录' },
        { name: 'activities', description: '活动数据' },
        { name: 'activity_participants', description: '活动参与者' },
        { name: 'store_status', description: '店铺状态' },
        { name: 'admins', description: '管理员数据' }
      ];

      // 通过云函数创建集合
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'createCollections',
          collections: collections
        }
      });

      if (result.result.success) {
        console.log('✅ 云数据库集合创建成功');
      } else {
        console.error('创建集合失败:', result.result.error);
      }
    } catch (error) {
      console.error('创建集合过程出错:', error);
    }
  },

  // 初始化云函数调用
  initCloudFunctions() {
    // 用户认证云函数
    this.callUserAuth = (action, data) => {
      return wx.cloud.callFunction({
        name: 'userAuth',
        data: { action, data }
      }).then(res => res.result);
    };

    // 活动管理云函数
    this.callActivityManager = (action, data) => {
      return wx.cloud.callFunction({
        name: 'activityManager',
        data: { action, data }
      }).then(res => res.result);
    };

    // 交易管理云函数
    this.callTransactionManager = (action, data) => {
      return wx.cloud.callFunction({
        name: 'transactionManager',
        data: { action, data }
      }).then(res => res.result);
    };

    // 店铺管理云函数
    this.callStoreManager = (action, data) => {
      return wx.cloud.callFunction({
        name: 'storeManager',
        data: { action, data }
      }).then(res => res.result);
    };
  },

  // 同步本地数据到云端（微信小程序方式）
  async syncLocalToCloud() {
    if (!this.globalData.isCloudConnected || this.globalData.syncInProgress) {
      return;
    }

    try {
      this.globalData.syncInProgress = true;
      console.log('开始同步本地数据到云端...');

      // 获取本地数据
      const localUsers = wx.getStorageSync('members') || [];
      const localActivities = wx.getStorageSync('activities') || [];
      const localTransactions = wx.getStorageSync('transactions') || [];

      // 通过云函数同步数据到云端
      try {
        // 同步用户数据
        for (const user of localUsers) {
          await this.callUserAuth('syncUser', user);
        }

        // 同步活动数据
        for (const activity of localActivities) {
          await this.callActivityManager('syncActivity', activity);
        }

        // 同步交易数据
        for (const transaction of localTransactions) {
          await this.callTransactionManager('syncTransaction', transaction);
        }

        console.log('本地数据同步到云端成功');

        // 同步成功后，再从云端拉取最新数据
        await this.syncCloudToLocal();
      } catch (cloudError) {
        console.error('云函数同步失败:', cloudError);
        // 即使云端同步失败，也要继续运行应用
      }
    } catch (error) {
      console.error('数据同步失败:', error);
    } finally {
      this.globalData.syncInProgress = false;
    }
  },

  // 从云端同步数据到本地（微信小程序方式）
  async syncCloudToLocal() {
    if (!this.globalData.isCloudConnected || this.globalData.syncInProgress) {
      return;
    }

    try {
      this.globalData.syncInProgress = true;
      console.log('开始从云端同步数据到本地...');

      try {
        // 从云端获取最新用户数据
        const usersResult = await this.callUserAuth('getAllUsers', {});
        if (usersResult.success && usersResult.data) {
          wx.setStorageSync('members', usersResult.data);
        }

        // 从云端获取最新活动数据
        const activitiesResult = await this.callActivityManager('getAllActivities', {});
        if (activitiesResult.success && activitiesResult.data) {
          wx.setStorageSync('activities', activitiesResult.data);
        }

        // 从云端获取最新交易数据
        const transactionsResult = await this.callTransactionManager('getAllTransactions', {});
        if (transactionsResult.success && transactionsResult.data) {
          wx.setStorageSync('transactions', transactionsResult.data);
        }

        console.log('云端数据同步到本地成功');

        // 更新全局数据
        await this.checkLoginStatus();
      } catch (cloudError) {
        console.error('云函数获取数据失败:', cloudError);
        // 云端同步失败时，保持本地数据不变
      }
    } catch (error) {
      console.error('云端数据同步失败:', error);
    } finally {
      this.globalData.syncInProgress = false;
    }
  },

  // 启动定期数据同步
  startDataSync() {
    if (!this.globalData.isCloudConnected) {
      return;
    }

    // 每5分钟同步一次数据
    setInterval(async () => {
      if (!this.globalData.syncInProgress) {
        await this.syncCloudToLocal();
      }
    }, 5 * 60 * 1000);
  },

  // 检查登录状态（微信小程序方式）
  async checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const memberCard = wx.getStorageSync('memberCard');
    const storeStatus = wx.getStorageSync('storeStatus');

    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;

      // 如果云数据库连接成功，从云端获取最新用户信息
      if (this.globalData.isCloudConnected) {
        try {
          const result = await this.callUserAuth('getUser', { phone: userInfo.phone });
          if (result.success && result.data) {
            const cloudUser = result.data;
            const updatedUserInfo = {
              phone: cloudUser.phone,
              name: cloudUser.name,
              avatarUrl: cloudUser.avatar_url,
              registerTime: cloudUser.register_time,
              lastLoginTime: cloudUser.last_login_time
            };
            this.globalData.userInfo = updatedUserInfo;
            wx.setStorageSync('userInfo', updatedUserInfo);
          }
        } catch (error) {
          console.error('获取云端用户信息失败:', error);
        }
      }

      // 检查是否为管理员
      this.globalData.isAdmin = this.isAdminUser(userInfo.phone, userInfo.name);
    }

    if (memberCard) {
      this.globalData.memberCard = memberCard;
    }

    if (storeStatus) {
      this.globalData.storeStatus = storeStatus;
    }
  },

  // 初始化本地数据
  initLocalData() {
    // 初始化店铺状态
    if (!wx.getStorageSync('storeStatus')) {
      wx.setStorageSync('storeStatus', {
        isOpen: false,
        openTime: '',
        closeTime: '',
        lastUpdate: ''
      });
    }

    // 初始化活动报名列表
    if (!wx.getStorageSync('activities')) {
      wx.setStorageSync('activities', []);
    }

    // 初始化会员列表
    if (!wx.getStorageSync('members')) {
      wx.setStorageSync('members', []);
    }
  },

  // 更新店铺状态
  updateStoreStatus(status) {
    this.globalData.storeStatus = status;
    wx.setStorageSync('storeStatus', status);
  },

  // 更新会员信息
  updateMemberCard(memberCard) {
    this.globalData.memberCard = memberCard;
    wx.setStorageSync('memberCard', memberCard);
  },

  // ==================== 动态管理员管理功能 ====================

  // 初始化默认管理员数据
  initDefaultAdmin() {
    const defaultAdmins = [
      {
        phone: '13614470578',
        name: '店长',
        role: 'super'
      },
      {
        phone: '13900000000',
        name: '副店长',
        role: 'normal'
      }
    ];

    if (!wx.getStorageSync('adminList')) {
      wx.setStorageSync('adminList', defaultAdmins);
    }
  },

  // 获取管理员列表
  getAdminList() {
    return wx.getStorageSync('adminList') || [];
  },

  // 检查是否为管理员
  isAdminUser(phone, name) {
    if (!phone || !name) return false;

    const adminList = this.getAdminList();
    return adminList.some(admin =>
      admin.phone === phone && admin.name === name
    );
  },

  // 获取用户角色
  getUserRole(phone, name) {
    const adminList = this.getAdminList();
    const admin = adminList.find(admin =>
      admin.phone === phone && admin.name === name
    );
    return admin ? admin.role : null;
  },

  // 添加管理员
  addAdmin(adminData) {
    try {
      const adminList = this.getAdminList();

      // 检查是否已存在
      if (adminList.some(admin => admin.phone === adminData.phone)) {
        return false;
      }

      adminList.push(adminData);
      wx.setStorageSync('adminList', adminList);
      return true;
    } catch (error) {
      return false;
    }
  },

  // 删除管理员
  removeAdmin(phone) {
    try {
      const adminList = this.getAdminList();
      const newAdminList = adminList.filter(admin => admin.phone !== phone);

      if (newAdminList.length === adminList.length) {
        return false; // 没有找到要删除的管理员
      }

      wx.setStorageSync('adminList', newAdminList);
      return true;
    } catch (error) {
      console.error('删除管理员失败:', error);
      return false;
    }
  },

  // 更新管理员
  updateAdmin(adminData) {
    try {
      const adminList = this.getAdminList();
      const index = adminList.findIndex(admin => admin.phone === adminData.phone);

      if (index === -1) {
        return false; // 没有找到要更新的管理员
      }

      adminList[index] = adminData;
      wx.setStorageSync('adminList', adminList);
      return true;
    } catch (error) {
      console.error('更新管理员失败:', error);
      return false;
    }
  },

  // 设置用户信息（包含管理员身份检查）
  setUserInfo(userInfo) {
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;

      // 检查是否为管理员
      this.globalData.isAdmin = this.isAdminUser(userInfo.phone, userInfo.name);

      // 同步存储到本地
      wx.setStorageSync('userInfo', userInfo);
    }
  },

  // 获取用户信息
  getUserInfo() {
    return this.globalData.userInfo;
  },

  // 获取管理员状态
  getIsAdmin() {
    return this.globalData.isAdmin || false;
  }
});
