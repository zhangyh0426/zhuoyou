// pages/cloud-test/cloud-test.js
const { WeixinCloudDatabase } = require('../../utils/weixin-cloud-database');

Page({
  data: {
    cloudDB: null,
    connectionStatus: '未连接',
    testResults: [],
    loading: false
  },

  onLoad() {
    // 初始化云数据库实例
    this.data.cloudDB = new WeixinCloudDatabase();
    this.testConnection();
  },

  // 测试云数据库连接
  async testConnection() {
    this.setData({ loading: true });
    
    try {
      const isHealthy = await this.data.cloudDB.healthCheck();
      this.setData({ 
        connectionStatus: isHealthy ? '连接正常' : '连接异常',
        loading: false
      });
      
      if (isHealthy) {
        this.addTestResult('✅ 云数据库连接正常', 'success');
      } else {
        this.addTestResult('❌ 云数据库连接异常', 'error');
      }
    } catch (error) {
      this.setData({ 
        connectionStatus: '连接失败',
        loading: false
      });
      this.addTestResult(`❌ 连接失败: ${error.message}`, 'error');
    }
  },

  // 测试用户数据操作
  async testUserOperations() {
    this.setData({ loading: true });
    
    try {
      // 测试添加用户
      const testUser = {
        phone: '13800138000',
        name: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg'
      };
      
      const userId = await this.data.cloudDB.addUser(testUser);
      this.addTestResult(`✅ 用户添加成功，ID: ${userId}`, 'success');
      
      // 测试获取用户
      const user = await this.data.cloudDB.getUser(testUser.phone);
      if (user) {
        this.addTestResult(`✅ 用户查询成功: ${user.name}`, 'success');
      }
      
      // 测试更新用户
      const updated = await this.data.cloudDB.updateUser(testUser.phone, {
        name: '更新后的用户名'
      });
      if (updated) {
        this.addTestResult('✅ 用户更新成功', 'success');
      }
      
    } catch (error) {
      this.addTestResult(`❌ 用户操作失败: ${error.message}`, 'error');
    }
    
    this.setData({ loading: false });
  },

  // 测试会员卡操作
  async testMemberCardOperations() {
    this.setData({ loading: true });
    
    try {
      const phone = '13800138000';
      
      // 获取会员卡
      const card = await this.data.cloudDB.getMemberCard(phone);
      if (card) {
        this.addTestResult(`✅ 会员卡查询成功，余额: ¥${card.balance}`, 'success');
      } else {
        // 创建会员卡
        const newCard = {
          userPhone: phone,
          balance: 100,
          points: 0,
          level: 'bronze'
        };
        
        const cardId = await this.data.cloudDB.addMemberCard(newCard);
        this.addTestResult(`✅ 会员卡创建成功，ID: ${cardId}`, 'success');
      }
      
      // 测试充值
      const rechargeResult = await this.data.cloudDB.rechargeMemberCard(phone, 50, '测试充值');
      if (rechargeResult) {
        this.addTestResult('✅ 会员卡充值成功', 'success');
      }
      
    } catch (error) {
      this.addTestResult(`❌ 会员卡操作失败: ${error.message}`, 'error');
    }
    
    this.setData({ loading: false });
  },

  // 测试交易记录操作
  async testTransactionOperations() {
    this.setData({ loading: true });
    
    try {
      const phone = '13800138000';
      
      // 添加交易记录
      const transaction = {
        userPhone: phone,
        type: 'recharge',
        amount: 100,
        description: '测试交易',
        status: 'completed'
      };
      
      const transactionId = await this.data.cloudDB.addTransaction(transaction);
      this.addTestResult(`✅ 交易记录添加成功，ID: ${transactionId}`, 'success');
      
      // 获取交易记录
      const transactions = await this.data.cloudDB.getTransactions(phone);
      this.addTestResult(`✅ 交易记录查询成功，共 ${transactions.length} 条`, 'success');
      
    } catch (error) {
      this.addTestResult(`❌ 交易记录操作失败: ${error.message}`, 'error');
    }
    
    this.setData({ loading: false });
  },

  // 测试活动操作
  async testActivityOperations() {
    this.setData({ loading: true });
    
    try {
      // 添加活动
      const activity = {
        title: '测试活动',
        description: '这是一个测试活动',
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后
        maxParticipants: 100,
        status: 'active'
      };
      
      const activityId = await this.data.cloudDB.addActivity(activity);
      this.addTestResult(`✅ 活动添加成功，ID: ${activityId}`, 'success');
      
      // 获取活动列表
      const activities = await this.data.cloudDB.getActivities();
      this.addTestResult(`✅ 活动列表查询成功，共 ${activities.length} 个活动`, 'success');
      
      // 报名活动
      const registration = {
        activityId: activityId,
        userPhone: '13800138000',
        userName: '测试用户'
      };
      
      const registrationId = await this.data.cloudDB.addActivityParticipant(registration);
      this.addTestResult(`✅ 活动报名成功，ID: ${registrationId}`, 'success');
      
    } catch (error) {
      this.addTestResult(`❌ 活动操作失败: ${error.message}`, 'error');
    }
    
    this.setData({ loading: false });
  },

  // 添加测试结果
  addTestResult(message, type) {
    const testResults = [...this.data.testResults];
    testResults.push({
      message,
      type,
      time: new Date().toLocaleTimeString()
    });
    
    this.setData({ testResults });
  },

  // 清空测试结果
  clearResults() {
    this.setData({ testResults: [] });
  },

  // 运行所有测试
  async runAllTests() {
    this.clearResults();
    this.addTestResult('🚀 开始运行所有测试...', 'info');
    
    await this.testConnection();
    await this.testUserOperations();
    await this.testMemberCardOperations();
    await this.testTransactionOperations();
    await this.testActivityOperations();
    
    this.addTestResult('✅ 所有测试完成', 'info');
  }
});