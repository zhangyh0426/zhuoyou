/**
 * 微信云开发数据库工具类 - 新手版本
 * 提供简单易用的云数据库操作方法
 * 
 * 使用方法：
 * const cloudDB = require('./weixin-cloud-database');
 * 
 * // 初始化
 * await cloudDB.init('您的环境ID');
 * 
 * // 使用各种方法
 * const user = await cloudDB.addUser({ phone: '13800138000', name: '张三' });
 */

class WeixinCloudDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.envId = '';
    
    // 定义集合列表
    this.collectionList = [
      'users', 'member_cards', 'transactions', 
      'activities', 'activity_participants', 
      'store_status', 'admins'
    ];
  }

  /**
   * 初始化云开发环境
   * @param {string} envId 微信云开发环境ID
   * @returns {Promise<boolean>}
   */
  async init(envId) {
    try {
      if (!wx.cloud) {
        throw new Error('微信云开发环境未启用，请检查小程序配置');
      }

      // 保存环境ID
      this.envId = envId;
      
      // 初始化云开发
      await wx.cloud.init({
        env: envId,
        traceUser: true
      });

      // 获取数据库实例
      this.db = wx.cloud.database();
      this.isInitialized = true;

      console.log('✅ 微信云数据库初始化成功');
      
      // 测试连接
      await this.testConnection();
      
      return true;
    } catch (error) {
      console.error('❌ 微信云数据库初始化失败:', error);
      return false;
    }
  }

  /**
   * 测试数据库连接
   * @private
   */
  async testConnection() {
    try {
      const result = await this.db.collection('users').limit(1).get();
      console.log('✅ 数据库连接测试成功');
    } catch (error) {
      console.warn('⚠️ 数据库连接测试失败，可能需要创建集合:', error.message);
    }
  }

  // ==================== 用户数据操作 ====================

  /**
   * 添加用户
   * @param {Object} userData 用户数据 { phone, name, avatarUrl }
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const user = await cloudDB.addUser({
   *   phone: '13800138000',
   *   name: '张三',
   *   avatarUrl: 'https://example.com/avatar.jpg'
   * });
   */
  async addUser(userData) {
    if (!userData.phone || !userData.name) {
      throw new Error('手机号和姓名不能为空');
    }

    // 检查用户是否已存在
    const existing = await this.getUser(userData.phone);
    if (existing) {
      throw new Error('用户已存在');
    }

    const data = {
      phone: userData.phone,
      name: userData.name,
      avatar_url: userData.avatarUrl || '',
      register_time: new Date(),
      last_login_time: new Date(),
      status: 'active',
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('users').add({
      data: data
    });

    return {
      _id: result._id,
      ...data
    };
  }

  /**
   * 获取用户信息
   * @param {string} phone 手机号
   * @returns {Promise<Object|null>}
   * 
   * 示例：
   * const user = await cloudDB.getUser('13800138000');
   */
  async getUser(phone) {
    if (!phone) {
      throw new Error('手机号不能为空');
    }

    const result = await this.db.collection('users')
      .where({
        phone: phone
      })
      .get();

    return result.data[0] || null;
  }

  /**
   * 更新用户信息
   * @param {string} phone 手机号
   * @param {Object} userData 更新的用户数据
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const updatedUser = await cloudDB.updateUser('13800138000', {
   *   name: '李四'
   * });
   */
  async updateUser(phone, userData) {
    if (!phone) {
      throw new Error('手机号不能为空');
    }

    const data = {
      ...userData,
      update_time: new Date()
    };

    await this.db.collection('users')
      .where({
        phone: phone
      })
      .update({
        data: data
      });

    return await this.getUser(phone);
  }

  /**
   * 获取所有用户列表
   * @param {number} page 页码，默认1
   * @param {number} pageSize 每页数量，默认20
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const result = await cloudDB.getUsers(1, 10);
   * console.log(result.data); // 用户列表
   * console.log(result.total); // 总数量
   */
  async getUsers(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    
    // 获取总数
    const totalResult = await this.db.collection('users').count();
    
    // 获取分页数据
    const result = await this.db.collection('users')
      .skip(skip)
      .limit(pageSize)
      .orderBy('register_time', 'desc')
      .get();

    return {
      data: result.data,
      total: totalResult.total,
      page,
      pageSize
    };
  }

  // ==================== 会员卡数据操作 ====================

  /**
   * 添加会员卡
   * @param {Object} cardData 会员卡数据 { userPhone, balance, points, level }
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const card = await cloudDB.addMemberCard({
   *   userPhone: '13800138000',
   *   balance: 100,
   *   points: 50,
   *   level: 'bronze'
   * });
   */
  async addMemberCard(cardData) {
    if (!cardData.userPhone) {
      throw new Error('用户手机号不能为空');
    }

    // 检查是否已有会员卡
    const existing = await this.getMemberCard(cardData.userPhone);
    if (existing) {
      throw new Error('用户已有会员卡');
    }

    const data = {
      user_phone: cardData.userPhone,
      balance: cardData.balance || 0,
      points: cardData.points || 0,
      level: cardData.level || 'bronze',
      join_date: new Date(),
      status: 'active',
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('member_cards').add({
      data: data
    });

    return {
      _id: result._id,
      ...data
    };
  }

  /**
   * 获取会员卡信息
   * @param {string} userPhone 用户手机号
   * @returns {Promise<Object|null>}
   * 
   * 示例：
   * const card = await cloudDB.getMemberCard('13800138000');
   */
  async getMemberCard(userPhone) {
    if (!userPhone) {
      throw new Error('用户手机号不能为空');
    }

    const result = await this.db.collection('member_cards')
      .where({
        user_phone: userPhone,
        status: 'active'
      })
      .get();

    return result.data[0] || null;
  }

  /**
   * 更新会员卡余额
   * @param {string} userPhone 用户手机号
   * @param {number} amount 变动金额
   * @param {string} type 变动类型（recharge/payment/refund）
   * @returns {Promise<Object>}
   * 
   * 示例：
   * // 充值50元
   * const card = await cloudDB.updateBalance('13800138000', 50, 'recharge');
   * 
   * // 消费30元
   * const card = await cloudDB.updateBalance('13800138000', 30, 'payment');
   */
  async updateBalance(userPhone, amount, type) {
    if (!userPhone) {
      throw new Error('用户手机号不能为空');
    }

    const card = await this.getMemberCard(userPhone);
    if (!card) {
      throw new Error('会员卡不存在');
    }

    let newBalance = card.balance;
    
    if (type === 'recharge' || type === 'refund') {
      newBalance += amount;
    } else if (type === 'payment') {
      newBalance -= amount;
      if (newBalance < 0) {
        throw new Error('余额不足');
      }
    }

    const data = {
      balance: newBalance,
      last_transaction_time: new Date(),
      update_time: new Date()
    };

    await this.db.collection('member_cards')
      .where({
        user_phone: userPhone
      })
      .update({
        data: data
      });

    return await this.getMemberCard(userPhone);
  }

  /**
   * 更新会员积分
   * @param {string} userPhone 用户手机号
   * @param {number} points 积分变动（正数增加，负数减少）
   * @returns {Promise<Object>}
   * 
   * 示例：
   * // 增加100积分
   * const card = await cloudDB.updatePoints('13800138000', 100);
   * 
   * // 扣除50积分
   * const card = await cloudDB.updatePoints('13800138000', -50);
   */
  async updatePoints(userPhone, points) {
    if (!userPhone) {
      throw new Error('用户手机号不能为空');
    }

    const card = await this.getMemberCard(userPhone);
    if (!card) {
      throw new Error('会员卡不存在');
    }

    const newPoints = Math.max(0, card.points + points); // 积分不能为负

    const data = {
      points: newPoints,
      update_time: new Date()
    };

    await this.db.collection('member_cards')
      .where({
        user_phone: userPhone
      })
      .update({
        data: data
      });

    return await this.getMemberCard(userPhone);
  }

  // ==================== 交易记录操作 ====================

  /**
   * 添加交易记录
   * @param {Object} transactionData 交易数据
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const transaction = await cloudDB.addTransaction({
   *   userPhone: '13800138000',
   *   type: 'recharge',
   *   amount: 100,
   *   description: '会员充值'
   * });
   */
  async addTransaction(transactionData) {
    if (!transactionData.userPhone || !transactionData.type || !transactionData.amount) {
      throw new Error('用户手机号、交易类型和金额不能为空');
    }

    const card = await this.getMemberCard(transactionData.userPhone);
    const currentBalance = card ? card.balance : 0;

    let balanceAfter = currentBalance;
    if (transactionData.type === 'recharge' || transactionData.type === 'refund') {
      balanceAfter += transactionData.amount;
    } else if (transactionData.type === 'payment') {
      balanceAfter -= transactionData.amount;
    }

    const data = {
      user_phone: transactionData.userPhone,
      type: transactionData.type, // recharge, payment, refund, bonus, penalty
      amount: transactionData.amount,
      balance_after: balanceAfter,
      description: transactionData.description || '',
      reference_id: transactionData.referenceId || '',
      reference_type: transactionData.referenceType || '',
      status: 'completed',
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('transactions').add({
      data: data
    });

    return {
      _id: result._id,
      ...data
    };
  }

  /**
   * 获取交易记录列表
   * @param {string} userPhone 用户手机号
   * @param {number} page 页码，默认1
   * @param {number} pageSize 每页数量，默认20
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const result = await cloudDB.getTransactions('13800138000', 1, 10);
   */
  async getTransactions(userPhone, page = 1, pageSize = 20) {
    if (!userPhone) {
      throw new Error('用户手机号不能为空');
    }

    const skip = (page - 1) * pageSize;
    
    const result = await this.db.collection('transactions')
      .where({
        user_phone: userPhone
      })
      .skip(skip)
      .limit(pageSize)
      .orderBy('create_time', 'desc')
      .get();

    return {
      data: result.data,
      page,
      pageSize
    };
  }

  // ==================== 活动数据操作 ====================

  /**
   * 添加活动
   * @param {Object} activityData 活动数据
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const activity = await cloudDB.addActivity({
   *   title: '狼人杀周末局',
   *   description: '一起玩狼人杀',
   *   type: 'werewolf',
   *   maxParticipants: 8,
   *   price: 20,
   *   startTime: '2024-01-20T19:00:00',
   *   endTime: '2024-01-20T22:00:00',
   *   location: '店铺A',
   *   createdBy: '13800138000'
   * });
   */
  async addActivity(activityData) {
    if (!activityData.title || !activityData.startTime || !activityData.createdBy) {
      throw new Error('活动标题、开始时间和创建者不能为空');
    }

    const data = {
      title: activityData.title,
      description: activityData.description || '',
      activity_type: activityData.type || 'werewolf',
      max_participants: activityData.maxParticipants || 8,
      price: activityData.price || 0,
      start_time: new Date(activityData.startTime),
      end_time: new Date(activityData.endTime),
      location: activityData.location || '',
      status: 'upcoming', // upcoming, ongoing, completed, cancelled
      current_participants: 0,
      created_by: activityData.createdBy,
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('activities').add({
      data: data
    });

    return {
      _id: result._id,
      ...data
    };
  }

  /**
   * 获取活动列表
   * @param {string} status 活动状态过滤，可选
   * @param {number} page 页码，默认1
   * @param {number} pageSize 每页数量，默认20
   * @returns {Promise<Object>}
   * 
   * 示例：
   * // 获取所有活动
   * const allActivities = await cloudDB.getActivities();
   * 
   * // 获取即将开始的活动
   * const upcomingActivities = await cloudDB.getActivities('upcoming');
   */
  async getActivities(status = null, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    
    let query = this.db.collection('activities')
      .skip(skip)
      .limit(pageSize)
      .orderBy('start_time', 'desc');

    if (status) {
      query = query.where({
        status: status
      });
    }

    const result = await query.get();

    return {
      data: result.data,
      page,
      pageSize
    };
  }

  /**
   * 获取活动详情
   * @param {string} activityId 活动ID
   * @returns {Promise<Object|null>}
   * 
   * 示例：
   * const activity = await cloudDB.getActivity('活动ID');
   */
  async getActivity(activityId) {
    if (!activityId) {
      throw new Error('活动ID不能为空');
    }

    const result = await this.db.collection('activities')
      .where({
        _id: activityId
      })
      .get();

    return result.data[0] || null;
  }

  /**
   * 参与活动
   * @param {string} activityId 活动ID
   * @param {string} userPhone 用户手机号
   * @param {number} paymentAmount 支付金额，默认0
   * @returns {Promise<Object>}
   * 
   * 示例：
   * // 免费参与活动
   * const participant = await cloudDB.joinActivity('活动ID', '13800138000');
   * 
   * // 付费参与活动
   * const participant = await cloudDB.joinActivity('活动ID', '13800138000', 20);
   */
  async joinActivity(activityId, userPhone, paymentAmount = 0) {
    if (!activityId || !userPhone) {
      throw new Error('活动ID和用户手机号不能为空');
    }

    const activity = await this.getActivity(activityId);
    if (!activity) {
      throw new Error('活动不存在');
    }

    if (activity.current_participants >= activity.max_participants) {
      throw new Error('活动人数已满');
    }

    // 检查是否已经报名
    const existing = await this.db.collection('activity_participants')
      .where({
        activity_id: activityId,
        user_phone: userPhone
      })
      .get();

    if (existing.data.length > 0) {
      throw new Error('已经报名参加此活动');
    }

    // 添加参与记录
    const participantData = {
      activity_id: activityId,
      user_phone: userPhone,
      join_time: new Date(),
      payment_status: paymentAmount > 0 ? 'paid' : 'pending',
      notes: '',
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('activity_participants').add({
      data: participantData
    });

    // 更新活动参与人数
    await this.db.collection('activities')
      .where({
        _id: activityId
      })
      .update({
        data: {
          current_participants: activity.current_participants + 1,
          update_time: new Date()
        }
      });

    // 如果需要付费，添加交易记录并更新会员卡余额
    if (paymentAmount > 0) {
      await this.addTransaction({
        userPhone: userPhone,
        type: 'payment',
        amount: paymentAmount,
        description: `参与活动: ${activity.title}`,
        referenceId: activityId,
        referenceType: 'activity'
      });

      // 更新会员卡余额
      await this.updateBalance(userPhone, paymentAmount, 'payment');
    }

    return {
      _id: result._id,
      ...participantData
    };
  }

  // ==================== 店铺状态操作 ====================

  /**
   * 获取店铺状态
   * @returns {Promise<Object|null>}
   * 
   * 示例：
   * const status = await cloudDB.getStoreStatus();
   * if (status) {
   *   console.log('店铺是否开门:', status.is_open);
   * }
   */
  async getStoreStatus() {
    const result = await this.db.collection('store_status')
      .orderBy('last_update', 'desc')
      .limit(1)
      .get();

    return result.data[0] || null;
  }

  /**
   * 更新店铺状态
   * @param {Object} statusData 状态数据
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const status = await cloudDB.updateStoreStatus({
   *   isOpen: true,
   *   openTime: '09:00',
   *   closeTime: '22:00',
   *   message: '欢迎光临！'
   * });
   */
  async updateStoreStatus(statusData) {
    if (typeof statusData.isOpen !== 'boolean') {
      throw new Error('开门状态不能为空');
    }

    const data = {
      is_open: statusData.isOpen,
      open_time: statusData.openTime || null,
      close_time: statusData.closeTime || null,
      last_update: new Date(),
      message: statusData.message || '',
      update_time: new Date()
    };

    // 先检查是否已有记录
    const existing = await this.getStoreStatus();
    
    if (existing) {
      // 更新现有记录
      await this.db.collection('store_status')
        .where({
          _id: existing._id
        })
        .update({
          data: data
        });
    } else {
      // 创建新记录
      await this.db.collection('store_status').add({
        data: {
          ...data,
          create_time: new Date()
        }
      });
    }

    return await this.getStoreStatus();
  }

  // ==================== 管理员数据操作 ====================

  /**
   * 添加管理员
   * @param {Object} adminData 管理员数据
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const admin = await cloudDB.addAdmin({
   *   phone: '13800138000',
   *   name: '店长',
   *   role: 'super',
   *   createdBy: 'original_admin'
   * });
   */
  async addAdmin(adminData) {
    if (!adminData.phone || !adminData.name) {
      throw new Error('管理员手机号和姓名不能为空');
    }

    const data = {
      phone: adminData.phone,
      name: adminData.name,
      role: adminData.role || 'normal',
      permissions: adminData.permissions || [],
      created_by: adminData.createdBy || '',
      create_time: new Date(),
      update_time: new Date()
    };

    const result = await this.db.collection('admins').add({
      data: data
    });

    return {
      _id: result._id,
      ...data
    };
  }

  /**
   * 获取管理员列表
   * @param {string} role 角色过滤，可选
   * @returns {Promise<Array>}
   * 
   * 示例：
   * // 获取所有管理员
   * const allAdmins = await cloudDB.getAdmins();
   * 
   * // 获取超级管理员
   * const superAdmins = await cloudDB.getAdmins('super');
   */
  async getAdmins(role = null) {
    let query = this.db.collection('admins')
      .orderBy('create_time', 'desc');

    if (role) {
      query = query.where({
        role: role
      });
    }

    const result = await query.get();
    return result.data;
  }

  /**
   * 检查用户是否为管理员
   * @param {string} phone 手机号
   * @returns {Promise<boolean>}
   * 
   * 示例：
   * const isAdmin = await cloudDB.isAdmin('13800138000');
   * if (isAdmin) {
   *   console.log('是管理员');
   * }
   */
  async isAdmin(phone) {
    if (!phone) {
      throw new Error('手机号不能为空');
    }

    const result = await this.db.collection('admins')
      .where({
        phone: phone
      })
      .get();

    return result.data.length > 0;
  }

  // ==================== 工具方法 ====================

  /**
   * 获取集合实例
   * @param {string} collectionName 集合名
   * @returns {Object}
   * 
   * 示例：
   * const usersCollection = cloudDB.getCollection('users');
   */
  getCollection(collectionName) {
    if (!this.isInitialized) {
      throw new Error('数据库未初始化，请先调用init方法');
    }

    if (!this.collectionList.includes(collectionName)) {
      throw new Error(`无效的集合名: ${collectionName}。支持的集合：${this.collectionList.join(', ')}`);
    }

    return this.db.collection(collectionName);
  }

  /**
   * 批量操作
   * @param {Array} operations 操作数组
   * @returns {Promise<Array>}
   * 
   * 示例：
   * const results = await cloudDB.batchOperations([
   *   { type: 'addUser', data: { phone: '13800138000', name: '张三' } },
   *   { type: 'addMemberCard', data: { userPhone: '13800138000', balance: 100 } }
   * ]);
   */
  async batchOperations(operations) {
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'addUser':
            result = await this.addUser(operation.data);
            break;
          case 'updateUser':
            result = await this.updateUser(operation.data.phone, operation.data.userData);
            break;
          case 'addTransaction':
            result = await this.addTransaction(operation.data);
            break;
          case 'addMemberCard':
            result = await this.addMemberCard(operation.data);
            break;
          default:
            console.warn(`不支持的操作类型: ${operation.type}`);
            continue;
        }
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * 健康检查
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const health = await cloudDB.healthCheck();
   * console.log('数据库状态:', health.status);
   */
  async healthCheck() {
    try {
      const result = await this.db.collection('users')
        .limit(1)
        .get();
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        connection: this.isInitialized,
        envId: this.envId
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message,
        connection: this.isInitialized,
        envId: this.envId
      };
    }
  }

  // ==================== 数据迁移方法 ====================

  /**
   * 将本地存储数据迁移到云端
   * @returns {Promise<Object>}
   * 
   * 示例：
   * const result = await cloudDB.migrateFromLocal();
   * console.log('迁移结果:', result);
   */
  async migrateFromLocal() {
    const migrationResult = {
      success: true,
      migratedUsers: 0,
      migratedActivities: 0,
      migratedStoreStatus: false,
      migratedAdmins: 0,
      errors: []
    };

    try {
      // 迁移用户数据
      const localUsers = wx.getStorageSync('members') || [];
      for (const user of localUsers) {
        try {
          await this.addUser({
            phone: user.phone,
            name: user.name,
            avatarUrl: user.avatarUrl
          });

          // 如果有会员信息，创建会员卡
          if (user.balance !== undefined || user.points !== undefined) {
            await this.addMemberCard({
              userPhone: user.phone,
              balance: user.balance || 0,
              points: user.points || 0,
              level: user.level || 'bronze'
            });
          }

          migrationResult.migratedUsers++;
        } catch (error) {
          migrationResult.errors.push(`用户迁移失败: ${user.phone} - ${error.message}`);
        }
      }

      // 迁移活动数据
      const localActivities = wx.getStorageSync('activities') || [];
      for (const activity of localActivities) {
        try {
          await this.addActivity({
            title: activity.title,
            description: activity.description,
            type: 'werewolf',
            maxParticipants: activity.maxPlayers,
            price: activity.price,
            startTime: `${activity.date}T${activity.time}`,
            location: activity.location,
            createdBy: activity.createdBy
          });

          migrationResult.migratedActivities++;
        } catch (error) {
          migrationResult.errors.push(`活动迁移失败: ${activity.title} - ${error.message}`);
        }
      }

      // 迁移店铺状态
      const localStoreStatus = wx.getStorageSync('storeStatus');
      if (localStoreStatus) {
        try {
          await this.updateStoreStatus({
            isOpen: localStoreStatus.isOpen,
            openTime: localStoreStatus.openTime,
            closeTime: localStoreStatus.closeTime,
            message: localStoreStatus.message || ''
          });

          migrationResult.migratedStoreStatus = true;
        } catch (error) {
          migrationResult.errors.push(`店铺状态迁移失败: ${error.message}`);
        }
      }

      // 迁移管理员数据
      const localAdmins = wx.getStorageSync('adminList') || [];
      for (const admin of localAdmins) {
        try {
          await this.addAdmin({
            phone: admin.phone,
            name: admin.name,
            role: admin.role,
            permissions: admin.permissions
          });

          migrationResult.migratedAdmins++;
        } catch (error) {
          migrationResult.errors.push(`管理员迁移失败: ${admin.phone} - ${error.message}`);
        }
      }

    } catch (error) {
      migrationResult.success = false;
      migrationResult.errors.push(`数据迁移过程出错: ${error.message}`);
    }

    return migrationResult;
  }
}

// 创建单例实例
const weixinCloudDatabase = new WeixinCloudDatabase();

module.exports = weixinCloudDatabase;